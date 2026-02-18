"use client";

import { useState, useRef, useEffect } from "react";

type Conversation = { id: string; title: string; model: string; created_at: number };

export default function Sidebar({
  conversations,
  currentId,
  onSelect,
  onNewChat,
  onDelete,
}: {
  conversations: Conversation[];
  currentId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onDelete: (id: string) => void;
}) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openMenuId) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenuId]);

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
          <div
            key={c.id}
            className={`group flex items-center gap-1 rounded-lg text-sm ${
              currentId === c.id
                ? "bg-[var(--border)] text-[var(--text)]"
                : "text-[var(--text-muted)] hover:bg-[var(--border)]/50 hover:text-[var(--text)]"
            }`}
          >
            <button
              onClick={() => onSelect(c.id)}
              className="flex-1 min-w-0 text-left px-3 py-2 truncate"
            >
              {c.title || "New chat"}
            </button>
            <div className="relative shrink-0" ref={openMenuId === c.id ? menuRef : undefined}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenMenuId(openMenuId === c.id ? null : c.id);
                }}
                className="p-1.5 rounded hover:bg-[var(--border)]/70 text-[var(--text-muted)]"
                aria-label="Menu"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="opacity-70"
                >
                  <circle cx="12" cy="6" r="1.5" />
                  <circle cx="12" cy="12" r="1.5" />
                  <circle cx="12" cy="18" r="1.5" />
                </svg>
              </button>
              {openMenuId === c.id && (
                <div className="absolute right-0 top-full mt-0.5 py-1 rounded-lg bg-[var(--surface)] border border-[var(--border)] shadow-lg z-10 min-w-[120px]">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(c.id);
                      setOpenMenuId(null);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-[var(--border)]/50"
                  >
                    Delete chat
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
