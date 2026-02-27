export type Conversation = {
  id: string;
  title: string;
  model: string;
  created_at: number;
  parent_id: string | null;
  branch_point_index: number | null;
};

/** DB-level message (includes conversation_id, created_at). */
export type Message = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: number;
};

/** Lightweight message used on the client (no DB metadata). */
export type ClientMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

/** An ancestor in a conversation's lineage chain. */
export type LineageEntry = {
  conversationId: string;
  branchPointIndex: number | null;
};

/** A single usage record for one API call. */
export type UsageRecord = {
  id: string;
  conversation_id: string;
  message_id: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost: number;
  created_at: number;
};

/** Aggregated usage totals for a conversation. */
export type ConversationUsage = {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
};
