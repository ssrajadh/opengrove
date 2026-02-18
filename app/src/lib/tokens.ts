import type { Message } from "@/types";

/**
 * Rough token estimator: ~4 characters per token.
 * Good enough for real-time budget calculations — the response buffer
 * absorbs estimation error.  Use provider-specific counting only when
 * exact costs matter (e.g. billing estimates).
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export type WindowResult = {
  /** Messages that fit within the token budget (chronological). */
  window: Message[];
  /** Messages that were excluded (oldest first). */
  overflow: Message[];
};

/**
 * Build a recent-message window that fits within `tokenBudget`.
 *
 * Rules:
 *  1. Walk backwards through messages, accumulating token cost.
 *  2. Never split a user/assistant pair — if one half doesn't fit, drop both.
 *  3. Return messages in chronological (original) order.
 *
 * Overflow messages (those that didn't fit) are returned separately for RAG embedding.
 */
export function buildMessageWindow(
  messages: Message[],
  tokenBudget: number,
): WindowResult {
  const window: Message[] = [];
  let tokensUsed = 0;

  // Walk backwards through messages in pairs (assistant, user).
  // Messages are ordered chronologically: [user, assistant, user, assistant, ...].
  // The last message is always the latest user message (just inserted).
  let i = messages.length - 1;

  while (i >= 0) {
    const current = messages[i];

    // If this is a standalone message (no pair), handle solo
    if (i === 0 || (current.role === "user" && (i === 0 || messages[i - 1].role === "user"))) {
      const cost = estimateTokens(current.content);
      if (tokensUsed + cost > tokenBudget) break;
      window.unshift(current);
      tokensUsed += cost;
      i--;
      continue;
    }

    // Grab the pair: messages[i-1] (user) and messages[i] (assistant)
    // or handle the edge case where ordering is unexpected
    if (current.role === "assistant" && i > 0 && messages[i - 1].role === "user") {
      const pairCost =
        estimateTokens(messages[i - 1].content) +
        estimateTokens(current.content);
      if (tokensUsed + pairCost > tokenBudget) break;
      window.unshift(messages[i - 1], current);
      tokensUsed += pairCost;
      i -= 2;
    } else {
      // Fallback: single message (consecutive same-role, etc.)
      const cost = estimateTokens(current.content);
      if (tokensUsed + cost > tokenBudget) break;
      window.unshift(current);
      tokensUsed += cost;
      i--;
    }
  }

  // Everything from index 0 through i (inclusive) didn't fit → overflow
  const overflow = i >= 0 ? messages.slice(0, i + 1) : [];

  return { window, overflow };
}
