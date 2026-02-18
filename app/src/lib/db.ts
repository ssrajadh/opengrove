import Database from "better-sqlite3";
import path from "path";

// When app lives in frontend/, store data at repo root
const DB_PATH = path.join(process.cwd(), "..", "opengrove.db");
const db = new Database(DB_PATH);

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

export type Conversation = {
  id: string;
  title: string;
  model: string;
  created_at: number;
};

export type Message = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: number;
};

export async function listConversations(): Promise<Conversation[]> {
  const stmt = db.prepare(
    "SELECT id, title, model, created_at FROM conversations ORDER BY created_at DESC"
  );
  return stmt.all() as Conversation[];
}

export async function getConversation(
  id: string
): Promise<Conversation | undefined> {
  const stmt = db.prepare(
    "SELECT id, title, model, created_at FROM conversations WHERE id = ?"
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
