export type Conversation = {
  id: string;
  title: string;
  model: string;
  created_at: number;
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
