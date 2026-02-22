"use client";

import { useMemo } from "react";
import type { ClientMessage } from "@/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const remarkPlugins = [remarkGfm];
const rehypePlugins = [rehypeHighlight];

export default function MessageList({
  messages,
  onBranch,
}: {
  messages: ClientMessage[];
  onBranch?: (messageIndex: number) => void;
}) {
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
        Send a message to start
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex-1 overflow-y-auto p-4 pb-4 space-y-6">
        {messages.map((m, idx) => {
          const isUser = m.role === "user";

          return (
            <div
              key={m.id}
              className={cn(
                "group flex items-end gap-2",
                isUser ? "justify-end" : "justify-start"
              )}
            >
              {/* Assistant message: left-aligned, no bubble, subtle left accent */}
              {!isUser && (
                <div className="flex-1 min-w-0 flex flex-col">
                  <div className="border-l-2 border-zinc-700 pl-4 py-1">
                    <div className="prose-chat break-words">
                      <ReactMarkdown
                        remarkPlugins={remarkPlugins}
                        rehypePlugins={rehypePlugins}
                      >
                        {m.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                  {onBranch && m.content && (
                    <div className="mt-1.5 pl-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-zinc-500 hover:text-zinc-300"
                            onClick={() => onBranch(idx)}
                          >
                            ⑂ Branch
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          Branch conversation from this message
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  )}
                </div>
              )}

              {/* User message: right-aligned muted bubble */}
              {isUser && (
                <div className="max-w-[80%] flex flex-col items-end">
                  <div className="rounded-2xl rounded-br-sm bg-zinc-800 border border-zinc-700/50 px-4 py-2.5">
                    <p className="whitespace-pre-wrap break-words text-sm text-zinc-100">
                      {m.content}
                    </p>
                  </div>
                  {onBranch && m.content && (
                    <div className="mt-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-zinc-500 hover:text-zinc-300"
                            onClick={() => onBranch(idx)}
                          >
                            ⑂ Branch
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          Branch conversation from this message
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
