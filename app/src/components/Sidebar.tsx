"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import type { Conversation } from "@/types";

type ConversationNode = Conversation & { children: ConversationNode[] };

/** Build a tree from a flat list using parent_id. */
function buildTree(conversations: Conversation[]): ConversationNode[] {
  const map = new Map<string, ConversationNode>();
  for (const c of conversations) {
    map.set(c.id, { ...c, children: [] });
  }
  const roots: ConversationNode[] = [];
  for (const node of Array.from(map.values())) {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  // Sort children newest-first
  for (const node of Array.from(map.values())) {
    node.children.sort((a: ConversationNode, b: ConversationNode) => b.created_at - a.created_at);
  }
  return roots;
}

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

  const tree = useMemo(() => buildTree(conversations), [conversations]);

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

  function renderItem(c: ConversationNode, depth: number) {
    return (
      <div key={c.id}>
        <div
          className={`group flex items-center gap-1 rounded-lg text-sm ${
            currentId === c.id
              ? "bg-[var(--border)] text-[var(--text)]"
              : "text-[var(--text-muted)] hover:bg-[var(--border)]/50 hover:text-[var(--text)]"
          }`}
          style={{ paddingLeft: `${Math.min(depth, 4) * 12 + 4}px` }}
        >
          {depth > 0 && (
            <span className="text-[var(--text-muted)] opacity-50 text-xs mr-0.5 select-none">⑂</span>
          )}
          <button
            onClick={() => onSelect(c.id)}
            className="flex-1 min-w-0 text-left px-2 py-2 truncate"
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
        {c.children.length > 0 && (
          <div className="border-l border-[var(--border)] ml-4">
            {c.children.map((child) => renderItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }

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
        {tree.map((c) => renderItem(c, 0))}
      </nav>
    </aside>
  );
}
