import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), "opengrove.json");

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

type Store = {
  conversations: Conversation[];
  messages: Message[];
};

function readStore(): Store {
  if (!fs.existsSync(DB_PATH)) {
    return { conversations: [], messages: [] };
  }
  const raw = fs.readFileSync(DB_PATH, "utf-8");
  try {
    return JSON.parse(raw) as Store;
  } catch {
    return { conversations: [], messages: [] };
  }
}

function writeStore(store: Store): void {
  fs.writeFileSync(DB_PATH, JSON.stringify(store, null, 2), "utf-8");
}

export async function listConversations(): Promise<Conversation[]> {
  const store = readStore();
  return [...store.conversations].sort((a, b) => b.created_at - a.created_at);
}

export async function getConversation(
  id: string
): Promise<Conversation | undefined> {
  const store = readStore();
  return store.conversations.find((c) => c.id === id);
}

export async function createConversation(
  id: string,
  model: string,
  title: string = "New chat"
): Promise<void> {
  const store = readStore();
  store.conversations.push({
    id,
    title,
    model,
    created_at: Math.floor(Date.now() / 1000),
  });
  writeStore(store);
}

export async function updateConversationTitle(
  id: string,
  title: string
): Promise<void> {
  const store = readStore();
  const c = store.conversations.find((x) => x.id === id);
  if (c) c.title = title;
  writeStore(store);
}

export async function deleteConversation(id: string): Promise<void> {
  const store = readStore();
  store.conversations = store.conversations.filter((c) => c.id !== id);
  store.messages = store.messages.filter((m) => m.conversation_id !== id);
  writeStore(store);
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const store = readStore();
  return store.messages
    .filter((m) => m.conversation_id === conversationId)
    .sort((a, b) => a.created_at - b.created_at);
}

export async function insertMessage(
  id: string,
  conversationId: string,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  const store = readStore();
  store.messages.push({
    id,
    conversation_id: conversationId,
    role,
    content,
    created_at: Math.floor(Date.now() / 1000),
  });
  writeStore(store);
}
