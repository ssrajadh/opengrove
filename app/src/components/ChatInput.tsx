"use client";

import { useRef, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowUp, Plus, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { GEMINI_MODELS, OPENAI_MODELS } from "@/lib/model-constants";
import { cn } from "@/lib/utils";

type ModelOption = { id: string; label: string };

const LOCAL_MODELS: ModelOption[] = [
  { id: "local-model-placeholder", label: "Coming soon" },
];

function openAiLabel(modelId: string): string {
  const suffix = modelId.replace(/^gpt-/, "");
  const normalized = suffix.endsWith("-mini")
    ? `${suffix.replace(/-mini$/, "")} Mini`
    : suffix;
  return `GPT-${normalized}`;
}

function geminiLabel(modelId: string): string {
  const suffix = modelId.replace(/^gemini-/, "");
  return `Gemini ${suffix
    .split("-")
    .map((part) => {
      if (part === "flash") return "Flash";
      if (part === "lite") return "Lite";
      if (part === "pro") return "Pro";
      if (part === "preview") return "Preview";
      return part;
    })
    .join(" ")}`;
}

const OPENAI_MODEL_OPTIONS: ModelOption[] = OPENAI_MODELS.map((id) => ({
  id,
  label: openAiLabel(id),
}));

const GEMINI_MODEL_OPTIONS: ModelOption[] = Object.keys(GEMINI_MODELS).map((id) => ({
  id,
  label: geminiLabel(id),
}));

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
  const [hasOpenAiKey, setHasOpenAiKey] = useState(false);
  const [hasGeminiKey, setHasGeminiKey] = useState(false);

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

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          openai_api_key?: unknown;
          gemini_api_key?: unknown;
        };
        if (cancelled) return;

        setHasOpenAiKey(
          typeof data.openai_api_key === "string" && data.openai_api_key.trim().length > 0
        );
        setHasGeminiKey(
          typeof data.gemini_api_key === "string" && data.gemini_api_key.trim().length > 0
        );
      } catch {
        // Ignore settings fetch errors; keep provider models disabled by default.
      }
    }

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  const currentModelLabel = useMemo(() => {
    const allModels = [
      ...OPENAI_MODEL_OPTIONS,
      ...GEMINI_MODEL_OPTIONS,
      ...LOCAL_MODELS,
    ];
    return allModels.find((m) => m.id === model)?.label ?? model;
  }, [model]);

  return (
    <div className="absolute inset-x-0 bottom-0 z-20">
      <div className="mx-auto w-full max-w-5xl px-4 py-3 flex flex-col items-stretch gap-2">
        {/* Input capsule */}
        <div className="relative flex w-full items-end gap-2 rounded-3xl border border-zinc-700/60 bg-zinc-900/95 pl-1.5 pr-1.5 py-1.5 focus-within:border-zinc-600 transition-colors">
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
          <TooltipProvider>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700/60 bg-zinc-900/65 px-3 py-1 text-xs text-zinc-400 hover:text-zinc-300 hover:border-zinc-600 transition-colors focus:outline-none">
                  {currentModelLabel}
                  <ChevronDown className="h-3 w-3 opacity-95" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="bg-zinc-900 border-zinc-700 min-w-[240px]">
                <DropdownMenuRadioGroup value={model} onValueChange={onModelChange}>
                  <DropdownMenuLabel className="text-zinc-400">OpenAI</DropdownMenuLabel>
                  {OPENAI_MODEL_OPTIONS.map((m) => {
                    const disabledItem = !hasOpenAiKey;
                    const item = (
                      <DropdownMenuRadioItem
                        key={m.id}
                        value={m.id}
                        disabled={disabledItem}
                        className={cn(
                          "text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100",
                          disabledItem ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                        )}
                      >
                        {m.label}
                      </DropdownMenuRadioItem>
                    );

                    if (!disabledItem) return item;

                    return (
                      <Tooltip key={m.id}>
                        <TooltipTrigger asChild>
                          <div>{item}</div>
                        </TooltipTrigger>
                        <TooltipContent>
                          Add your OpenAI API key in Settings to use these models
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}

                  <DropdownMenuSeparator className="bg-zinc-800" />
                  <DropdownMenuLabel className="text-zinc-400">Google Gemini</DropdownMenuLabel>
                  {GEMINI_MODEL_OPTIONS.map((m) => {
                    const disabledItem = !hasGeminiKey;
                    const item = (
                      <DropdownMenuRadioItem
                        key={m.id}
                        value={m.id}
                        disabled={disabledItem}
                        className={cn(
                          "text-zinc-300 focus:bg-zinc-800 focus:text-zinc-100",
                          disabledItem ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
                        )}
                      >
                        {m.label}
                      </DropdownMenuRadioItem>
                    );

                    if (!disabledItem) return item;

                    return (
                      <Tooltip key={m.id}>
                        <TooltipTrigger asChild>
                          <div>{item}</div>
                        </TooltipTrigger>
                        <TooltipContent>
                          Add your Google Gemini API key in Settings to use these models
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}

                  <DropdownMenuSeparator className="bg-zinc-800" />
                  <DropdownMenuLabel className="text-zinc-400">Local Models</DropdownMenuLabel>
                  {LOCAL_MODELS.map((m) => (
                    <Tooltip key={m.id}>
                      <TooltipTrigger asChild>
                        <div>
                          <DropdownMenuRadioItem
                            value={m.id}
                            disabled
                            className="text-zinc-300 opacity-50 cursor-not-allowed"
                          >
                            {m.label}
                          </DropdownMenuRadioItem>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        Local model support coming soon
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}
