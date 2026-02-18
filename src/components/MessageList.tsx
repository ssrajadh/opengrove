"use client";

type Message = { id: string; role: "user" | "assistant"; content: string };

export default function MessageList({ messages }: { messages: Message[] }) {
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-sm">
        Send a message to start
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((m) => (
        <div
          key={m.id}
          className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`max-w-[85%] rounded-lg px-4 py-2.5 text-sm ${
              m.role === "user"
                ? "bg-[var(--user-msg)] border border-[var(--border)]"
                : "bg-[var(--ai-msg)] border border-[var(--border)]"
            }`}
          >
            <p className="whitespace-pre-wrap break-words">{m.content}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
