import Database from "better-sqlite3";
import path from "path";
import * as sqliteVec from "sqlite-vec";
import type { Conversation, Message, LineageEntry } from "@/types";
import { randomUUID } from "crypto";

export type { Conversation, Message, LineageEntry };

// ---------------------------------------------------------------------------
// Database setup
// ---------------------------------------------------------------------------

const DB_PATH = path.join(process.cwd(), "..", "opengrove.db");
const db = new Database(DB_PATH);

// Load sqlite-vec extension for vector search (graceful fallback)
let vecLoaded = false;
try {
  sqliteVec.load(db);
  vecLoaded = true;
} catch (err) {
  console.warn("sqlite-vec failed to load. RAG features will be disabled.", err);
}

export { vecLoaded };

// Core tables
db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'New chat',
    model TEXT NOT NULL DEFAULT 'gemini-2.0-flash',
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
`);

// Migration: add is_embedded column to messages
try {
  db.exec("ALTER TABLE messages ADD COLUMN is_embedded INTEGER NOT NULL DEFAULT 0");
} catch {
  // Column already exists — ignore
}

// Migration: add branching columns to conversations
try {
  db.exec("ALTER TABLE conversations ADD COLUMN parent_id TEXT DEFAULT NULL");
} catch {
  // Column already exists — ignore
}
try {
  db.exec("ALTER TABLE conversations ADD COLUMN branch_point_index INTEGER DEFAULT NULL");
} catch {
  // Column already exists — ignore
}

// Embedding model config (singleton row)
db.exec(`
  CREATE TABLE IF NOT EXISTS embedding_config (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    model TEXT NOT NULL,
    dimensions INTEGER NOT NULL,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
`);

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

export async function listConversations(): Promise<Conversation[]> {
  const stmt = db.prepare(
    "SELECT id, title, model, created_at, parent_id, branch_point_index FROM conversations ORDER BY created_at DESC"
  );
  return stmt.all() as Conversation[];
}

export async function getConversation(
  id: string
): Promise<Conversation | undefined> {
  const stmt = db.prepare(
    "SELECT id, title, model, created_at, parent_id, branch_point_index FROM conversations WHERE id = ?"
  );
  return stmt.get(id) as Conversation | undefined;
}

export async function createConversation(
  id: string,
  model: string,
  title: string = "New chat"
): Promise<void> {
  const stmt = db.prepare(
    "INSERT INTO conversations (id, title, model) VALUES (?, ?, ?)"
  );
  stmt.run(id, title, model);
}

export async function updateConversationTitle(
  id: string,
  title: string
): Promise<void> {
  const stmt = db.prepare("UPDATE conversations SET title = ? WHERE id = ?");
  stmt.run(title, id);
}

export async function deleteConversation(id: string): Promise<void> {
  const stmt = db.prepare("DELETE FROM conversations WHERE id = ?");
  stmt.run(id);
}

/**
 * Collect all descendant conversation IDs (children, grandchildren, …)
 * using an iterative BFS.
 */
export function getDescendantIds(id: string): string[] {
  const stmt = db.prepare(
    "SELECT id FROM conversations WHERE parent_id = ?"
  );
  const descendants: string[] = [];
  const queue: string[] = [id];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const children = stmt.all(current) as { id: string }[];
    for (const child of children) {
      descendants.push(child.id);
      queue.push(child.id);
    }
  }

  return descendants;
}

/**
 * Check whether a conversation has any child branches.
 */
export function hasChildren(id: string): boolean {
  const row = db.prepare(
    "SELECT 1 FROM conversations WHERE parent_id = ? LIMIT 1"
  ).get(id);
  return row != null;
}

/**
 * Delete a conversation and all its descendants (cascade).
 * Also cleans up vector chunks for each deleted conversation.
 */
export async function deleteConversationTree(id: string): Promise<void> {
  const descendants = getDescendantIds(id);
  const allIds = [id, ...descendants];

  // Clean up vector chunks for all conversations being deleted
  for (const cid of allIds) {
    deleteChunksForConversation(cid);
  }

  // Delete all conversations (messages cascade via FK)
  const placeholders = allIds.map(() => "?").join(",");
  db.prepare(
    `DELETE FROM conversations WHERE id IN (${placeholders})`
  ).run(...allIds);
}

// ---------------------------------------------------------------------------
// Branching
// ---------------------------------------------------------------------------

/**
 * Create a new conversation branched from `parentId` at `branchPointIndex`.
 * No messages are copied — the branch references the parent's messages
 * up to `branchPointIndex` via the lineage chain.  Only new messages
 * added after branching live in the branch's own `messages` rows.
 * Returns the new conversation's ID.
 */
export async function createBranch(
  parentId: string,
  branchPointIndex: number,
): Promise<string> {
  const parent = await getConversation(parentId);
  if (!parent) throw new Error(`Parent conversation ${parentId} not found`);

  const branchId = randomUUID();
  const title = `Branch of ${parent.title}`.slice(0, 80);

  db.prepare(
    "INSERT INTO conversations (id, title, model, parent_id, branch_point_index) VALUES (?, ?, ?, ?, ?)"
  ).run(branchId, title, parent.model, parentId, branchPointIndex);

  return branchId;
}

/**
 * Walk up the parent chain from `conversationId`, returning the full lineage.
 * The result is ordered from the current conversation (index 0) up to the
 * root ancestor.  Each entry includes the conversation ID and the branch
 * point index (null for the root).
 */
export function getConversationLineage(conversationId: string): LineageEntry[] {
  const lineage: LineageEntry[] = [];
  const stmt = db.prepare(
    "SELECT id, parent_id, branch_point_index FROM conversations WHERE id = ?"
  );

  let currentId: string | null = conversationId;
  const visited = new Set<string>();

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const row = stmt.get(currentId) as {
      id: string;
      parent_id: string | null;
      branch_point_index: number | null;
    } | undefined;
    if (!row) break;

    lineage.push({
      conversationId: row.id,
      branchPointIndex: row.branch_point_index,
    });
    currentId = row.parent_id;
  }

  return lineage;
}

/**
 * Resolve the full message history for a conversation by walking up the
 * lineage chain and concatenating inherited + own messages.
 *
 * For a root conversation this is equivalent to `getMessages(id)`.
 * For a branch it returns:
 *   parent history[0..branchPoint] + own messages (ordered chronologically).
 * Recurses for deeply nested branches.
 */
export async function getFullHistory(
  conversationId: string,
): Promise<Message[]> {
  const lineage = getConversationLineage(conversationId);

  // lineage is [self, parent, grandparent, ... , root]
  // Build history bottom-up: start from root, slice at each branch point,
  // then append the branch's own messages.
  const segments: Message[][] = [];

  for (let i = lineage.length - 1; i >= 0; i--) {
    const entry = lineage[i];
    const msgs = await getMessages(entry.conversationId);

    if (i === lineage.length - 1) {
      // Root (or furthest ancestor): take messages up to the *next*
      // entry's branch point (if there is a next entry).
      const nextEntry = i > 0 ? lineage[i - 1] : null;
      if (nextEntry && nextEntry.branchPointIndex != null) {
        segments.push(msgs.slice(0, nextEntry.branchPointIndex + 1));
      } else {
        segments.push(msgs);
      }
    } else if (i > 0) {
      // Intermediate ancestor: own messages, sliced at the child's branch point
      const nextEntry = lineage[i - 1];
      if (nextEntry.branchPointIndex != null) {
        segments.push(msgs.slice(0, nextEntry.branchPointIndex + 1));
      } else {
        segments.push(msgs);
      }
    } else {
      // The conversation itself: all its own messages
      segments.push(msgs);
    }
  }

  return segments.flat();
}

/**
 * Get direct child conversations that branch from a given conversation.
 */
export function getChildConversations(parentId: string): Conversation[] {
  const stmt = db.prepare(
    "SELECT id, title, model, created_at, parent_id, branch_point_index FROM conversations WHERE parent_id = ?"
  );
  return stmt.all(parentId) as Conversation[];
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export async function getMessages(
  conversationId: string
): Promise<Message[]> {
  const stmt = db.prepare(
    "SELECT id, conversation_id, role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC"
  );
  return stmt.all(conversationId) as Message[];
}

export async function insertMessage(
  id: string,
  conversationId: string,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  const stmt = db.prepare(
    "INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)"
  );
  stmt.run(id, conversationId, role, content);
}

// ---------------------------------------------------------------------------
// Embedding config
// ---------------------------------------------------------------------------

export type EmbeddingConfig = {
  id: number;
  model: string;
  dimensions: number;
  updated_at: number;
};

export function getEmbeddingConfig(): EmbeddingConfig | undefined {
  const stmt = db.prepare("SELECT * FROM embedding_config WHERE id = 1");
  return stmt.get() as EmbeddingConfig | undefined;
}

export function upsertEmbeddingConfig(model: string, dimensions: number): void {
  const stmt = db.prepare(`
    INSERT INTO embedding_config (id, model, dimensions, updated_at)
    VALUES (1, ?, ?, unixepoch())
    ON CONFLICT(id) DO UPDATE SET model = ?, dimensions = ?, updated_at = unixepoch()
  `);
  stmt.run(model, dimensions, model, dimensions);
}

// ---------------------------------------------------------------------------
// Vector table management (sqlite-vec)
// ---------------------------------------------------------------------------

export function createVectorTable(dimensions: number): void {
  if (!vecLoaded) return;
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS message_chunks USING vec0(
      chunk_id text primary key,
      conversation_id text partition key,
      +chunk_text text,
      +start_msg_index integer,
      +end_msg_index integer,
      +embedding_model text,
      +created_at integer,
      embedding float[${dimensions}]
    );
  `);
}

export function dropVectorTable(): void {
  if (!vecLoaded) return;
  db.exec("DROP TABLE IF EXISTS message_chunks");
}

// ---------------------------------------------------------------------------
// Message embedding status
// ---------------------------------------------------------------------------

export function markMessagesEmbedded(ids: string[]): void {
  const stmt = db.prepare("UPDATE messages SET is_embedded = 1 WHERE id = ?");
  const tx = db.transaction((msgIds: string[]) => {
    for (const msgId of msgIds) stmt.run(msgId);
  });
  tx(ids);
}

export function resetAllEmbeddings(): void {
  db.exec("UPDATE messages SET is_embedded = 0");
  dropVectorTable();
}

export function getUnembeddedMessageIds(conversationId: string): Set<string> {
  const stmt = db.prepare(
    "SELECT id FROM messages WHERE conversation_id = ? AND is_embedded = 0"
  );
  const rows = stmt.all(conversationId) as { id: string }[];
  return new Set(rows.map((r) => r.id));
}

// ---------------------------------------------------------------------------
// Chunk storage & retrieval
// ---------------------------------------------------------------------------

export type ChunkRow = {
  chunk_id: string;
  conversation_id: string;
  chunk_text: string;
  start_msg_index: number;
  end_msg_index: number;
  embedding_model: string;
  created_at: number;
  distance: number;
};

export function insertChunk(
  chunkId: string,
  conversationId: string,
  text: string,
  startIndex: number,
  endIndex: number,
  model: string,
  embedding: Float32Array,
): void {
  if (!vecLoaded) return;
  const stmt = db.prepare(
    `INSERT INTO message_chunks
       (chunk_id, conversation_id, chunk_text, start_msg_index, end_msg_index, embedding_model, created_at, embedding)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  stmt.run(
    chunkId, conversationId, text, startIndex, endIndex, model,
    Math.floor(Date.now() / 1000),
    Buffer.from(embedding.buffer),
  );
}

export function queryChunks(
  conversationIds: string[],
  queryEmbedding: Float32Array,
  k: number,
  maxMsgIndex?: number,
): ChunkRow[] {
  if (!vecLoaded || conversationIds.length === 0) return [];

  // sqlite-vec partition key supports a single value, so we query each
  // conversation ID separately and merge results by distance.
  const stmt = db.prepare(`
    SELECT chunk_id, conversation_id, chunk_text, start_msg_index, end_msg_index,
           embedding_model, created_at, distance
    FROM message_chunks
    WHERE embedding MATCH ? AND conversation_id = ? AND k = ?
    ORDER BY distance
  `);

  const embeddingBuf = Buffer.from(queryEmbedding.buffer);
  const allResults: ChunkRow[] = [];

  for (const cid of conversationIds) {
    const rows = stmt.all(embeddingBuf, cid, k) as ChunkRow[];
    allResults.push(...rows);
  }

  // Filter by max message index if specified (for branch-aware queries)
  let filtered = allResults;
  if (maxMsgIndex != null) {
    filtered = allResults.filter((r) => r.start_msg_index <= maxMsgIndex);
  }

  // Sort by distance, take top-k
  filtered.sort((a, b) => a.distance - b.distance);
  return filtered.slice(0, k);
}

export function deleteChunksForConversation(id: string): void {
  if (!vecLoaded) return;
  try {
    const stmt = db.prepare("DELETE FROM message_chunks WHERE conversation_id = ?");
    stmt.run(id);
  } catch {
    // Virtual table may not exist yet — ignore
  }
}
