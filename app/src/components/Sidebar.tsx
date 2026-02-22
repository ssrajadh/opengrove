"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import type { Conversation } from "@/types";
import ConfirmModal from "./ConfirmModal";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

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
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
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
    const isActive = currentId === c.id;

    return (
      <div key={c.id}>
        <div
          className={cn(
            "group flex items-center gap-1 rounded-md text-sm transition-colors",
            isActive
              ? "bg-zinc-800 text-zinc-100"
              : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
          )}
          style={{ paddingLeft: `${Math.min(depth, 4) * 16 + 4}px` }}
        >
          {depth > 0 && (
            <span className="text-zinc-600 text-xs mr-0.5 select-none">⑂</span>
          )}
          <button
            onClick={() => onSelect(c.id)}
            className="flex-1 min-w-0 text-left px-2 py-1.5 truncate"
          >
            {c.title || "New chat"}
          </button>
          <div className="relative shrink-0" ref={openMenuId === c.id ? menuRef : undefined}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpenMenuId(openMenuId === c.id ? null : c.id);
              }}
              className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-zinc-700 text-zinc-500 transition-opacity"
              aria-label="Menu"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <circle cx="12" cy="6" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="12" cy="18" r="1.5" />
              </svg>
            </button>
            {openMenuId === c.id && (
              <div className="absolute right-0 top-full mt-1 py-1 rounded-md bg-zinc-800 border border-zinc-700 shadow-xl z-10 min-w-[130px]">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenuId(null);
                    if (c.children.length > 0) {
                      setConfirmDeleteId(c.id);
                    } else {
                      onDelete(c.id);
                    }
                  }}
                  className="w-full text-left px-3 py-1.5 text-sm text-red-400 hover:bg-zinc-700/70 rounded-sm transition-colors"
                >
                  Delete chat
                </button>
              </div>
            )}
          </div>
        </div>
        {c.children.length > 0 && (
          <div className="ml-4 border-l border-zinc-700/60 pl-1">
            {c.children.map((child) => renderItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  return (
    <aside className="w-56 shrink-0 border-r border-zinc-800 bg-zinc-900 flex flex-col">
      <div className="p-3">
        <Button
          onClick={onNewChat}
          variant="outline"
          className="w-full justify-start gap-2 border-zinc-700 bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New chat
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <nav className="px-2 pb-2">
          {conversations.length === 0 && (
            <p className="text-zinc-500 text-xs px-2 py-4">
              No conversations yet
            </p>
          )}
          {tree.map((c) => renderItem(c, 0))}
        </nav>
      </ScrollArea>

      {confirmDeleteId && (
        <ConfirmModal
          title="Delete chat and subchats"
          message="Deleting this chat will also delete all subchats below it. Are you sure?"
          confirmLabel="Delete all"
          onConfirm={() => {
            onDelete(confirmDeleteId);
            setConfirmDeleteId(null);
          }}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}
    </aside>
  );
}
