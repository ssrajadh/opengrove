"use client";

import { useRef, useCallback, useEffect } from "react";
import { ArrowUp, Plus, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const MODELS = [
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  { id: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite" },
  { id: "gemini-3-flash-preview", label: "Gemini 3 Flash" },
  { id: "gemini-3-pro-preview", label: "Gemini 3 Pro" },
  { id: "gpt-4o", label: "GPT-4o" },
  { id: "gpt-4o-mini", label: "GPT-4o Mini" },
  { id: "gpt-4.1", label: "GPT-4.1" },
  { id: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
];

const MAX_ROWS = 6;
const LINE_HEIGHT = 20; // px, approximate for text-sm
const PADDING_Y = 16; // py-2 = 8px * 2

export default function ChatInput({
  value,
  onChange,
  onSend,
  model,
  onModelChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  model: string;
  onModelChange: (v: string) => void;
  disabled?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange(e.target.value);
      // Auto-resize
      const ta = e.target;
      ta.style.height = "auto";
      const maxHeight = LINE_HEIGHT * MAX_ROWS + PADDING_Y;
      ta.style.height = `${Math.min(ta.scrollHeight, maxHeight)}px`;
    },
    [onChange]
  );

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const maxHeight = LINE_HEIGHT * MAX_ROWS + PADDING_Y;
    ta.style.height = `${Math.min(ta.scrollHeight, maxHeight)}px`;
  }, [value]);

  const currentModelLabel =
    MODELS.find((m) => m.id === model)?.label ?? model;

  return (
    <div className="sticky bottom-0 shrink-0">
      <div className="mx-auto w-full max-w-5xl px-4 py-3 flex flex-col items-stretch gap-2">
        {/* Input capsule */}
        <div className="relative flex w-full items-end gap-2 rounded-3xl border border-zinc-700/60 bg-zinc-900 pl-1.5 pr-1.5 py-1.5 focus-within:border-zinc-600 transition-colors">
          {/* Plus button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-full text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
          >
            <Plus className="h-4 w-4" />
          </Button>

          <Textarea
            ref={textareaRef}
            value={value}
            onChange={handleInput}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder="Message..."
            rows={1}
            disabled={disabled}
            className="flex-1 resize-none overflow-y-auto border-0 bg-transparent p-0 py-1 text-sm text-zinc-100 placeholder:text-zinc-500 shadow-none focus-visible:ring-0 min-h-0 max-h-[136px] leading-5"
          />

          {/* Send button */}
          <Button
            onClick={onSend}
            disabled={disabled || !value.trim()}
            size="icon"
            className={cn(
              "h-8 w-8 shrink-0 rounded-full transition-colors",
              value.trim() && !disabled
                ? "bg-zinc-100 text-zinc-900 hover:bg-white"
                : "bg-zinc-700 text-zinc-400"
            )}
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        </div>

        {/* Model selector pill below */}
        <div className="flex items-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700/60 bg-zinc-900 px-3 py-1 text-xs text-zinc-400 hover:text-zinc-300 hover:border-zinc-600 transition-colors focus:outline-none">
                {currentModelLabel}
                <ChevronDown className="h-3 w-3 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="bg-zinc-900 border-zinc-700 min-w-[200px]">
              <DropdownMenuRadioGroup value={model} onValueChange={onModelChange}>
                {MODELS.map((m) => (
                  <DropdownMenuRadioItem
                    key={m.id}
                    value={m.id}
                    className="text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100 cursor-pointer"
                  >
                    {m.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
