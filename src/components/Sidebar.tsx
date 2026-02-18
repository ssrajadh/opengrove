"use client";

type Conversation = { id: string; title: string; model: string; created_at: number };

export default function Sidebar({
  conversations,
  currentId,
  onSelect,
  onNewChat,
}: {
  conversations: Conversation[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
}) {
  return (
    <aside className="w-56 shrink-0 border-r border-[var(--border)] bg-[var(--surface)] flex flex-col">
      <button
        onClick={onNewChat}
        className="m-3 px-3 py-2 rounded-lg border border-[var(--border)] text-sm hover:bg-[var(--border)] transition-colors"
      >
        + New chat
      </button>
      <nav className="flex-1 overflow-y-auto p-2">
        {conversations.length === 0 && (
          <p className="text-[var(--text-muted)] text-xs px-2 py-4">
            No conversations yet
          </p>
        )}
        {conversations.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm truncate block ${
              currentId === c.id
                ? "bg-[var(--border)] text-[var(--text)]"
                : "text-[var(--text-muted)] hover:bg-[var(--border)]/50 hover:text-[var(--text)]"
            }`}
          >
            {c.title || "New chat"}
          </button>
        ))}
      </nav>
    </aside>
  );
}
