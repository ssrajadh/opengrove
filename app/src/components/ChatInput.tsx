"use client";

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
  return (
    <div className="border-t border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="max-w-3xl mx-auto flex flex-col gap-2">
        <div className="flex gap-2 items-center">
          <select
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            className="bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--border)]"
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder="Message..."
            rows={2}
            disabled={disabled}
            className="flex-1 resize-none bg-[var(--bg)] border border-[var(--border)] rounded-lg px-4 py-3 text-sm text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--border)] disabled:opacity-50"
          />
          <button
            onClick={onSend}
            disabled={disabled || !value.trim()}
            className="px-4 py-2 rounded-lg bg-[var(--border)] hover:bg-[var(--text-muted)]/20 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
