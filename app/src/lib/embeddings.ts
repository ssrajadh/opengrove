import OpenAI from "openai/index.mjs";
import { randomUUID } from "crypto";
import type { Message } from "@/types";
import {
  vecLoaded,
  getEmbeddingConfig,
  upsertEmbeddingConfig,
  createVectorTable,
  resetAllEmbeddings,
  insertChunk,
  markMessagesEmbedded,
  getUnembeddedMessageIds,
} from "@/lib/db";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;

// ---------------------------------------------------------------------------
// Embedding config lifecycle
// ---------------------------------------------------------------------------

let configChecked = false;

/**
 * Ensure the embedding config row and vector table exist.
 * If the configured model/dimensions changed, wipe all stale vectors
 * and recreate the table with the new dimensions.
 *
 * Idempotent — fast no-op after the first call per process.
 */
export async function ensureEmbeddingConfig(): Promise<void> {
  if (configChecked || !vecLoaded) return;

  const existing = getEmbeddingConfig();

  if (!existing) {
    // First-time setup
    upsertEmbeddingConfig(EMBEDDING_MODEL, EMBEDDING_DIMENSIONS);
    createVectorTable(EMBEDDING_DIMENSIONS);
  } else if (
    existing.model !== EMBEDDING_MODEL ||
    existing.dimensions !== EMBEDDING_DIMENSIONS
  ) {
    // Model changed — wipe stale vectors and recreate
    console.log(
      `Embedding model changed: ${existing.model} (${existing.dimensions}d) → ${EMBEDDING_MODEL} (${EMBEDDING_DIMENSIONS}d). Re-embedding required.`,
    );
    resetAllEmbeddings();
    upsertEmbeddingConfig(EMBEDDING_MODEL, EMBEDDING_DIMENSIONS);
    createVectorTable(EMBEDDING_DIMENSIONS);
  } else {
    // Same model — just ensure table exists (no-op if already created)
    createVectorTable(EMBEDDING_DIMENSIONS);
  }

  configChecked = true;
}

// ---------------------------------------------------------------------------
// OpenAI embedding calls
// ---------------------------------------------------------------------------

/**
 * Embed multiple texts in a single API call (batch embedding).
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set — cannot embed");

  const openai = new OpenAI({ apiKey });
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
  });

  return response.data.map((d) => d.embedding);
}

/** Embed a single text. Convenience wrapper around `embedTexts`. */
export async function embedText(text: string): Promise<number[]> {
  const [embedding] = await embedTexts([text]);
  return embedding;
}

// ---------------------------------------------------------------------------
// Chunking
// ---------------------------------------------------------------------------

export type Chunk = {
  text: string;
  messageIds: string[];
  startIndex: number;
  endIndex: number;
};

/**
 * Group messages into chunks of `chunkSize`, serializing each as
 * `ROLE: content` with newlines between messages.  Preserves message
 * IDs for marking as embedded afterwards.
 */
export function chunkMessages(messages: Message[], chunkSize = 4): Chunk[] {
  const chunks: Chunk[] = [];
  for (let i = 0; i < messages.length; i += chunkSize) {
    const group = messages.slice(i, i + chunkSize);
    const text = group
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n");
    chunks.push({
      text,
      messageIds: group.map((m) => m.id),
      startIndex: i,
      endIndex: i + group.length,
    });
  }
  return chunks;
}

// ---------------------------------------------------------------------------
// Embed & store overflow
// ---------------------------------------------------------------------------

/**
 * Chunk, embed, and store overflow messages that haven't been embedded yet.
 * Marks source messages as `is_embedded = 1` after successful storage.
 *
 * This is designed to be called fire-and-forget (errors are logged, not thrown).
 */
export async function embedAndStoreOverflow(
  conversationId: string,
  overflowMessages: Message[],
): Promise<void> {
  if (overflowMessages.length === 0 || !vecLoaded) return;

  try {
    await ensureEmbeddingConfig();

    // Filter to only messages not yet embedded
    const unembeddedIds = getUnembeddedMessageIds(conversationId);
    const unembedded = overflowMessages.filter((m) => unembeddedIds.has(m.id));
    if (unembedded.length === 0) return;

    const chunks = chunkMessages(unembedded);
    if (chunks.length === 0) return;

    const texts = chunks.map((c) => c.text);
    const embeddings = await embedTexts(texts);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkId = randomUUID();
      const embedding = new Float32Array(embeddings[i]);

      insertChunk(
        chunkId,
        conversationId,
        chunk.text,
        chunk.startIndex,
        chunk.endIndex,
        EMBEDDING_MODEL,
        embedding,
      );
    }

    // Mark all processed messages as embedded
    const allMsgIds = chunks.flatMap((c) => c.messageIds);
    markMessagesEmbedded(allMsgIds);
  } catch (err) {
    // Non-fatal: RAG is a nice-to-have, don't break the chat flow
    console.error("Failed to embed overflow messages:", err);
  }
}
