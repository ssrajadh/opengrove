"use client";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import MessageList from "@/components/MessageList";
import ChatInput from "@/components/ChatInput";

type Conversation = {
  id: string;
  title: string;
  model: string;
  created_at: number;
};

type Message = { id: string; role: "user" | "assistant"; content: string };

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [model, setModel] = useState("gemini-2.0-flash");
  const [loading, setLoading] = useState(false);

  const fetchConversations = useCallback(async () => {
    const res = await fetch("/api/conversations");
    if (res.ok) {
      const data = await res.json();
      setConversations(data);
    }
  }, []);

  const fetchMessages = useCallback(async (id: string) => {
    const res = await fetch(`/api/conversations/${id}`);
    if (res.ok) {
      const data = await res.json();
      setMessages(data.messages ?? []);
    } else {
      setMessages([]);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    if (currentId) {
      fetchMessages(currentId);
    } else {
      setMessages([]);
    }
  }, [currentId, fetchMessages]);

  const handleNewChat = () => {
    setCurrentId(null);
    setMessages([]);
    setInput("");
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: currentId,
          message: text,
          model,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => prev.slice(0, -1));
        alert(data.error ?? "Send failed");
        return;
      }

      setCurrentId(data.conversationId);
      setMessages((prev) => [...prev, data.message]);
      await fetchConversations();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex">
      <Sidebar
        conversations={conversations}
        currentId={currentId}
        onSelect={setCurrentId}
        onNewChat={handleNewChat}
      />
      <main className="flex-1 flex flex-col min-w-0">
        <header className="shrink-0 border-b border-[var(--border)] px-4 py-3">
          <h1 className="text-sm font-medium text-[var(--text-muted)]">
            OpenGrove
          </h1>
        </header>
        <MessageList messages={messages} />
        <ChatInput
          value={input}
          onChange={setInput}
          onSend={handleSend}
          model={model}
          onModelChange={setModel}
          disabled={loading}
        />
      </main>
    </div>
  );
}
