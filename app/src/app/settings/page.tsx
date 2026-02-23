"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ProviderId = "openai" | "gemini" | "anthropic";
type ProviderStatus = "idle" | "saving" | "saved" | "error" | "testing" | "success" | "failure";

type ProviderConfig = {
  id: ProviderId;
  name: string;
  keySetting: "openai_api_key" | "gemini_api_key" | "anthropic_api_key";
  models: Array<{ id: string; label: string }>;
};

const PROVIDERS: ProviderConfig[] = [
  {
    id: "openai",
    name: "OpenAI",
    keySetting: "openai_api_key",
    models: [
      { id: "gpt-4o", label: "GPT-4o" },
      { id: "gpt-4o-mini", label: "GPT-4o Mini" },
      { id: "gpt-4.1", label: "GPT-4.1" },
      { id: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
    ],
  },
  {
    id: "gemini",
    name: "Google Gemini",
    keySetting: "gemini_api_key",
    models: [
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
      { id: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite" },
      { id: "gemini-3-flash-preview", label: "Gemini 3 Flash" },
      { id: "gemini-3-pro-preview", label: "Gemini 3 Pro" },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    keySetting: "anthropic_api_key",
    models: [
      { id: "claude-3-5-haiku-latest", label: "Claude 3.5 Haiku" },
      { id: "claude-3-5-sonnet-latest", label: "Claude 3.5 Sonnet" },
      { id: "claude-3-opus-latest", label: "Claude 3 Opus" },
    ],
  },
];

function parseHiddenModels(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === "string")
        : [];
    } catch {
      return [];
    }
  }
  return [];
}

function statusClass(status: ProviderStatus) {
  if (status === "saved" || status === "success") return "text-emerald-400";
  if (status === "error" || status === "failure") return "text-red-400";
  return "text-zinc-500";
}

export default function SettingsPage() {
  const [apiKeys, setApiKeys] = useState<Record<ProviderId, string>>({
    openai: "",
    gemini: "",
    anthropic: "",
  });
  const [hiddenModels, setHiddenModels] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [keyStatus, setKeyStatus] = useState<Record<ProviderId, { status: ProviderStatus; message: string }>>({
    openai: { status: "idle", message: "" },
    gemini: { status: "idle", message: "" },
    anthropic: { status: "idle", message: "" },
  });
  const [testStatus, setTestStatus] = useState<Record<ProviderId, { status: ProviderStatus; message: string }>>({
    openai: { status: "idle", message: "" },
    gemini: { status: "idle", message: "" },
    anthropic: { status: "idle", message: "" },
  });
  const [hiddenSaveError, setHiddenSaveError] = useState("");

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load settings");
      const data = (await res.json()) as Record<string, unknown>;

      setApiKeys({
        openai: typeof data.openai_api_key === "string" ? data.openai_api_key : "",
        gemini: typeof data.gemini_api_key === "string" ? data.gemini_api_key : "",
        anthropic: typeof data.anthropic_api_key === "string" ? data.anthropic_api_key : "",
      });
      setHiddenModels(new Set(parseHiddenModels(data.hidden_models)));
    } catch {
      setHiddenSaveError("Failed to load settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const saveSettingsPatch = useCallback(async (payload: Record<string, unknown>) => {
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? "Failed to save settings");
    }
    return (await res.json()) as Record<string, unknown>;
  }, []);

  const handleSaveKey = useCallback(
    async (provider: ProviderConfig) => {
      const apiKey = apiKeys[provider.id].trim();
      setKeyStatus((prev) => ({
        ...prev,
        [provider.id]: { status: "saving", message: "Saving..." },
      }));

      try {
        await saveSettingsPatch({
          [provider.keySetting]: apiKey,
          hidden_models: Array.from(hiddenModels),
        });
        setKeyStatus((prev) => ({
          ...prev,
          [provider.id]: { status: "saved", message: "Saved" },
        }));
      } catch (err) {
        setKeyStatus((prev) => ({
          ...prev,
          [provider.id]: {
            status: "error",
            message: err instanceof Error ? err.message : "Save failed",
          },
        }));
      }
    },
    [apiKeys, hiddenModels, saveSettingsPatch]
  );

  const handleTestConnection = useCallback(
    async (provider: ProviderConfig) => {
      const apiKey = apiKeys[provider.id].trim();
      if (!apiKey) {
        setTestStatus((prev) => ({
          ...prev,
          [provider.id]: { status: "failure", message: "Enter an API key first" },
        }));
        return;
      }

      setTestStatus((prev) => ({
        ...prev,
        [provider.id]: { status: "testing", message: "Testing..." },
      }));

      try {
        const res = await fetch("/api/settings/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: provider.id, apiKey }),
        });
        const data = (await res.json()) as { success?: boolean; message?: string };
        if (!res.ok || !data.success) {
          setTestStatus((prev) => ({
            ...prev,
            [provider.id]: {
              status: "failure",
              message: data.message ?? "Connection failed",
            },
          }));
          return;
        }

        setTestStatus((prev) => ({
          ...prev,
          [provider.id]: {
            status: "success",
            message: data.message ?? "Connection successful",
          },
        }));
      } catch (err) {
        setTestStatus((prev) => ({
          ...prev,
          [provider.id]: {
            status: "failure",
            message: err instanceof Error ? err.message : "Connection failed",
          },
        }));
      }
    },
    [apiKeys]
  );

  const persistHiddenModels = useCallback(
    async (nextHidden: Set<string>) => {
      setHiddenSaveError("");
      try {
        const data = await saveSettingsPatch({ hidden_models: Array.from(nextHidden) });
        setHiddenModels(new Set(parseHiddenModels(data.hidden_models)));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to save model visibility";
        setHiddenSaveError(message);
        throw new Error(message);
      }
    },
    [saveSettingsPatch]
  );

  const providerById = useMemo(() => {
    const map = new Map<ProviderId, ProviderConfig>();
    for (const provider of PROVIDERS) map.set(provider.id, provider);
    return map;
  }, []);

  const toggleModelVisibility = useCallback(
    (providerId: ProviderId, modelId: string) => {
      const provider = providerById.get(providerId);
      if (!provider) return;
      if (!apiKeys[providerId].trim()) return;

      const previous = new Set(hiddenModels);
      const next = new Set(hiddenModels);
      if (next.has(modelId)) {
        next.delete(modelId);
      } else {
        next.add(modelId);
      }
      setHiddenModels(next);

      void persistHiddenModels(next).catch(() => {
        setHiddenModels(previous);
      });
    },
    [apiKeys, hiddenModels, persistHiddenModels, providerById]
  );

  return (
    <main className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <div className="mx-auto w-full max-w-4xl px-6 py-8">
        <div className="mb-6">
          <Link
            href="/"
            className="text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Back to chat
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-100">Settings</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Configure app behavior and model providers.
          </p>
        </div>

        <Tabs defaultValue="general" className="w-full">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="llm-providers">LLM Providers</TabsTrigger>
            <TabsTrigger value="local-models">Local Models</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-5">
            <h2 className="text-lg font-medium text-zinc-100">General</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Basic application settings and default behavior will appear here.
            </p>
          </TabsContent>

          <TabsContent value="llm-providers" className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-5">
            <h2 className="text-lg font-medium text-zinc-100">LLM Providers</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Manage API keys, test provider connections, and choose which models are visible.
            </p>

            {hiddenSaveError && (
              <p className="mt-3 text-sm text-red-400">{hiddenSaveError}</p>
            )}

            <div className="mt-5 grid gap-4">
              {PROVIDERS.map((provider) => {
                const hasKey = apiKeys[provider.id].trim().length > 0;
                const keyState = keyStatus[provider.id];
                const testState = testStatus[provider.id];

                return (
                  <section
                    key={provider.id}
                    className="rounded-lg border border-zinc-800 bg-zinc-900 p-4"
                  >
                    <h3 className="text-base font-medium text-zinc-100">{provider.name}</h3>

                    <div className="mt-3 flex flex-col gap-2 md:flex-row">
                      <Input
                        type="password"
                        value={apiKeys[provider.id]}
                        onChange={(e) => {
                          const value = e.target.value;
                          setApiKeys((prev) => ({ ...prev, [provider.id]: value }));
                        }}
                        placeholder={`${provider.name} API key`}
                        className="border-zinc-700 bg-zinc-950 text-zinc-100 placeholder:text-zinc-500"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-zinc-800"
                        onClick={() => void handleSaveKey(provider)}
                        disabled={keyState.status === "saving" || loading}
                      >
                        Save
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-zinc-800"
                        onClick={() => void handleTestConnection(provider)}
                        disabled={testState.status === "testing" || loading}
                      >
                        Test connection
                      </Button>
                    </div>

                    {(keyState.message || testState.message) && (
                      <div className="mt-2 flex flex-col gap-1 text-sm">
                        {keyState.message && (
                          <p className={statusClass(keyState.status)}>{keyState.message}</p>
                        )}
                        {testState.message && (
                          <p className={statusClass(testState.status)}>{testState.message}</p>
                        )}
                      </div>
                    )}

                    <div className={`mt-4 rounded-md border border-zinc-800 p-3 ${hasKey ? "" : "opacity-50"}`}>
                      <p className="text-sm font-medium text-zinc-200">Visible models</p>
                      {!hasKey && (
                        <p className="mt-1 text-xs text-zinc-500">Enter and save an API key to enable model toggles.</p>
                      )}
                      <div className="mt-3 space-y-2">
                        {provider.models.map((model) => {
                          const visible = !hiddenModels.has(model.id);
                          return (
                            <div key={model.id} className="flex items-center justify-between gap-3">
                              <span className="text-sm text-zinc-300">{model.label}</span>
                              <button
                                type="button"
                                role="switch"
                                aria-checked={visible}
                                onClick={() => toggleModelVisibility(provider.id, model.id)}
                                disabled={!hasKey || loading}
                                className={`relative h-6 w-11 rounded-full transition-colors ${
                                  visible ? "bg-emerald-500" : "bg-zinc-700"
                                } disabled:cursor-not-allowed`}
                              >
                                <span
                                  className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                                    visible ? "translate-x-5" : "translate-x-0"
                                  }`}
                                />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="local-models" className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-5">
            <h2 className="text-lg font-medium text-zinc-100">Local Models</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Local runtime configuration and model visibility controls will appear here.
            </p>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
