"use client";

import type { ClientMessage } from "@/types";

export default function MessageList({
  messages,
  onBranch,
}: {
  messages: ClientMessage[];
  onBranch?: (messageIndex: number) => void;
}) {
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-[var(--text-muted)] text-sm">
        Send a message to start
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((m, idx) => (
        <div
          key={m.id}
          className={`group flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`max-w-[85%] rounded-lg px-4 py-2.5 text-sm ${
              m.role === "user"
                ? "bg-[var(--user-msg)] border border-[var(--border)]"
                : "bg-[var(--ai-msg)] border border-[var(--border)]"
            }`}
          >
            <p className="whitespace-pre-wrap break-words">{m.content}</p>
            {onBranch && m.content && (
              <button
                onClick={() => onBranch(idx)}
                className="mt-1 text-xs text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity hover:text-[var(--text)]"
                title="Branch conversation from this message"
              >
                ⑂ Branch
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
