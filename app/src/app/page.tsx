"use client";

import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import MessageList from "@/components/MessageList";
import ChatInput from "@/components/ChatInput";
import type { Conversation, ClientMessage } from "@/types";

type Message = ClientMessage;

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

  const handleDeleteChat = async (id: string) => {
    const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    if (currentId === id) {
      handleNewChat();
    }
    await fetchConversations();
  };

  const handleBranch = async (messageIndex: number) => {
    if (!currentId || loading) return;
    try {
      const res = await fetch(`/api/conversations/${currentId}/branch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageIndex }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Branch failed");
        return;
      }
      const branch = await res.json();
      await fetchConversations();
      setCurrentId(branch.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Branch failed");
    }
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

    const streamingAssistantId = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: streamingAssistantId, role: "assistant", content: "" },
    ]);

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

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessages((prev) => prev.filter((m) => m.id !== streamingAssistantId));
        alert(data.error ?? "Send failed");
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (!reader) {
        setMessages((prev) => prev.filter((m) => m.id !== streamingAssistantId));
        alert("Streaming not supported");
        return;
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          let data: { type: string; text?: string; error?: string; conversationId?: string; message?: Message };
          try {
            data = JSON.parse(trimmed) as typeof data;
          } catch {
            continue;
          }
          if (data.type === "chunk" && typeof data.text === "string") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === streamingAssistantId
                  ? { ...m, content: m.content + data.text }
                  : m
              )
            );
          } else if (data.type === "done" && data.conversationId != null && data.message) {
            setCurrentId(data.conversationId);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === streamingAssistantId ? data.message! : m
              )
            );
            await fetchConversations();
          } else if (data.type === "error") {
            setMessages((prev) => prev.filter((m) => m.id !== streamingAssistantId));
            alert(data.error ?? "Chat failed");
          }
        }
      }

      if (buffer.trim()) {
        try {
          const data = JSON.parse(buffer.trim()) as { type: string; error?: string; conversationId?: string; message?: Message };
          if (data.type === "done" && data.conversationId != null && data.message) {
            setCurrentId(data.conversationId);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === streamingAssistantId ? data.message! : m
              )
            );
            await fetchConversations();
          } else if (data.type === "error") {
            setMessages((prev) => prev.filter((m) => m.id !== streamingAssistantId));
            alert(data.error ?? "Chat failed");
          }
        } catch {
          // ignore final line parse errors
        }
      }
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== streamingAssistantId));
      alert(err instanceof Error ? err.message : "Send failed");
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
        onDelete={handleDeleteChat}
      />
      <main className="flex-1 flex flex-col min-w-0">
        <header className="shrink-0 border-b border-[var(--border)] px-4 py-3">
          <h1 className="text-sm font-medium text-[var(--text-muted)]">
            OpenGrove
          </h1>
        </header>
        <MessageList messages={messages} onBranch={currentId ? handleBranch : undefined} />
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
