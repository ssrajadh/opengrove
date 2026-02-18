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
