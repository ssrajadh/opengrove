import type { Message } from "@/types";
import { buildMessageWindow, estimateTokens } from "@/lib/tokens";
import { queryChunks, getConversationLineage, vecLoaded } from "@/lib/db";
import { embedText, ensureEmbeddingConfig } from "@/lib/embeddings";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Don't bother with RAG for very short queries (useless embeddings). */
const MIN_QUERY_TOKENS = 10;

/** Fraction of available context reserved for RAG chunks. */
const RAG_BUDGET_RATIO = 0.2;

// ---------------------------------------------------------------------------
// Retrieval
// ---------------------------------------------------------------------------

/**
 * Embed `query`, run KNN search against stored chunks for the conversation
 * and its ancestors (branch lineage), and return chunk texts within budget.
 *
 * For branched conversations the lineage is walked:
 *  - Current conversation → all chunks
 *  - Parent conversation → chunks where start_msg_index <= branch_point
 *  - Grandparent → same rule, using parent's branch_point
 *  …until the root.
 */
async function retrieveRelevantChunks(
  conversationId: string,
  query: string,
  tokenBudget: number,
  k = 5,
): Promise<string[]> {
  const queryEmbedding = await embedText(query);
  const embeddingVec = new Float32Array(queryEmbedding);

  // Resolve the full lineage (current → root)
  const lineage = getConversationLineage(conversationId);

  // The first entry is the current conversation (no index cap).
  // Subsequent entries are ancestors — capped at their branch_point_index.
  // We query each ancestor separately so we can apply per-ancestor caps,
  // then merge results.
  const allConversationIds = lineage.map((e) => e.conversationId);

  // Find the tightest maxMsgIndex for ancestor conversations.
  // For the current conversation (index 0), no limit.
  // For ancestors, limit to their branch_point_index.
  let maxMsgIndex: number | undefined;
  if (lineage.length > 1 && lineage[1].branchPointIndex != null) {
    maxMsgIndex = lineage[1].branchPointIndex;
  }

  const results = queryChunks(allConversationIds, embeddingVec, k, maxMsgIndex);

  const chunks: string[] = [];
  let tokensUsed = 0;
  for (const row of results) {
    const chunkTokens = estimateTokens(row.chunk_text);
    if (tokensUsed + chunkTokens > tokenBudget) break;
    chunks.push(row.chunk_text);
    tokensUsed += chunkTokens;
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type RAGResult = {
  /** Joined RAG context to inject, or null if none. */
  ragContext: string | null;
  /** Recent messages that fit in the window. */
  recentMessages: Message[];
  /** Older messages that were excluded from the window. */
  overflow: Message[];
};

/**
 * Build the full context for a chat request:
 *
 *  1. Split the available budget into RAG vs. recent-messages.
 *  2. Window the messages to fit the recent budget.
 *  3. If there is overflow *and* the query is meaningful, retrieve
 *     relevant chunks from the vector store.
 *  4. Return everything the caller needs to construct the provider payload.
 */
export async function buildContextWithRAG(
  conversationId: string,
  allMessages: Message[],
  query: string,
  contextLimit: number,
  responseBuffer: number,
): Promise<RAGResult> {
  const available = contextLimit - responseBuffer;

  // If vec is not loaded or OPENAI_API_KEY absent, skip RAG entirely —
  // give the full budget to the recent-message window.
  const ragEnabled =
    vecLoaded && Boolean(process.env.OPENAI_API_KEY);

  const ragBudget = ragEnabled ? Math.floor(available * RAG_BUDGET_RATIO) : 0;
  const recentBudget = available - ragBudget;

  const { window: recentMessages, overflow } = buildMessageWindow(
    allMessages,
    recentBudget,
  );

  // Skip RAG when there's nothing to retrieve from, or query is trivial
  if (
    !ragEnabled ||
    overflow.length === 0 ||
    estimateTokens(query) < MIN_QUERY_TOKENS
  ) {
    return { ragContext: null, recentMessages, overflow };
  }

  try {
    await ensureEmbeddingConfig();

    const chunks = await retrieveRelevantChunks(
      conversationId,
      query,
      ragBudget,
    );

    if (chunks.length === 0) {
      return { ragContext: null, recentMessages, overflow };
    }

    const ragContext = chunks.join("\n---\n");
    return { ragContext, recentMessages, overflow };
  } catch (err) {
    console.error("RAG retrieval failed:", err);
    // Graceful degradation — proceed without RAG context
    return { ragContext: null, recentMessages, overflow };
  }
}
