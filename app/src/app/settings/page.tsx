"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ProviderId = "openai" | "gemini" | "anthropic";
type ProviderStatus = "idle" | "saving" | "saved" | "error" | "testing" | "success" | "failure";
type LocalRuntime = "ollama" | "lmstudio" | "llamacpp" | "custom";
type LocalTestStatus = "idle" | "testing" | "success" | "failure";

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

const LOCAL_RUNTIME_OPTIONS: Array<{ value: LocalRuntime; label: string }> = [
  { value: "ollama", label: "Ollama" },
  { value: "lmstudio", label: "LM Studio" },
  { value: "llamacpp", label: "llama.cpp" },
  { value: "custom", label: "Other / OpenAI-compatible" },
];

const LOCAL_RUNTIME_ENDPOINTS: Record<LocalRuntime, string> = {
  ollama: "http://localhost:11434",
  lmstudio: "http://localhost:1234",
  llamacpp: "http://localhost:8080",
  custom: "",
};

const LOCAL_RUNTIME_HELPERS: Record<LocalRuntime, string> = {
  ollama: "Make sure Ollama is running (ollama serve)",
  lmstudio: "Enable the local server in LM Studio under the Local Server tab",
  llamacpp: "Start the server with ./server -m your-model.gguf",
  custom: "",
};

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

function parseBooleanSetting(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function parseLocalRuntime(value: unknown): LocalRuntime {
  if (
    value === "ollama" ||
    value === "lmstudio" ||
    value === "llamacpp" ||
    value === "custom"
  ) {
    return value;
  }
  return "custom";
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
  const [localModelsEnabled, setLocalModelsEnabled] = useState(false);
  const [localRuntime, setLocalRuntime] = useState<LocalRuntime>("custom");
  const [localEndpoint, setLocalEndpoint] = useState("");
  const [localHiddenModels, setLocalHiddenModels] = useState<Set<string>>(new Set());
  const [localAvailableModels, setLocalAvailableModels] = useState<string[]>([]);
  const [localStatus, setLocalStatus] = useState<{ status: LocalTestStatus; message: string }>({
    status: "idle",
    message: "",
  });

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
      setLocalModelsEnabled(parseBooleanSetting(data.local_models_enabled));
      setLocalRuntime(parseLocalRuntime(data.local_runtime));
      setLocalEndpoint(typeof data.local_endpoint === "string" ? data.local_endpoint : "");
      setLocalHiddenModels(new Set(parseHiddenModels(data.local_models_hidden)));
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

  const persistLocalSettings = useCallback(
    async (payload: Record<string, unknown>) => {
      const data = await saveSettingsPatch(payload);
      if (Object.prototype.hasOwnProperty.call(payload, "local_models_enabled")) {
        setLocalModelsEnabled(parseBooleanSetting(data.local_models_enabled));
      }
      if (Object.prototype.hasOwnProperty.call(payload, "local_runtime")) {
        setLocalRuntime(parseLocalRuntime(data.local_runtime));
      }
      if (Object.prototype.hasOwnProperty.call(payload, "local_endpoint")) {
        setLocalEndpoint(typeof data.local_endpoint === "string" ? data.local_endpoint : "");
      }
      if (Object.prototype.hasOwnProperty.call(payload, "local_models_hidden")) {
        setLocalHiddenModels(new Set(parseHiddenModels(data.local_models_hidden)));
      }
    },
    [saveSettingsPatch]
  );

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

  const handleLocalEnabledChange = useCallback(async (nextEnabled: boolean) => {
    setLocalModelsEnabled(nextEnabled);
    try {
      await persistLocalSettings({
        local_models_enabled: nextEnabled ? "true" : "false",
      });
    } catch {
      setLocalModelsEnabled((prev) => !prev);
    }
  }, [persistLocalSettings]);

  const handleLocalRuntimeChange = useCallback(async (nextRuntime: LocalRuntime) => {
    const nextEndpoint = LOCAL_RUNTIME_ENDPOINTS[nextRuntime];
    setLocalRuntime(nextRuntime);
    setLocalEndpoint(nextEndpoint);
    try {
      await persistLocalSettings({
        local_runtime: nextRuntime,
        local_endpoint: nextEndpoint,
      });
    } catch {
      // Ignore: state remains optimistic for a better editing flow.
    }
  }, [persistLocalSettings]);

  const handleLocalEndpointChange = useCallback(async (value: string) => {
    setLocalEndpoint(value);
    try {
      await persistLocalSettings({ local_endpoint: value });
    } catch {
      // Ignore: preserve current typed value in the input.
    }
  }, [persistLocalSettings]);

  const toggleLocalModelVisibility = useCallback((modelId: string) => {
    const previous = new Set(localHiddenModels);
    const next = new Set(localHiddenModels);
    if (next.has(modelId)) {
      next.delete(modelId);
    } else {
      next.add(modelId);
    }
    setLocalHiddenModels(next);

    void persistLocalSettings({
      local_models_hidden: JSON.stringify(Array.from(next)),
    }).catch(() => {
      setLocalHiddenModels(previous);
    });
  }, [localHiddenModels, persistLocalSettings]);

  const testLocalConnection = useCallback(async () => {
    setLocalStatus({ status: "testing", message: "" });
    try {
      const res = await fetch("/api/local-models", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as { models?: unknown; error?: string };
      if (!res.ok || data.error) {
        setLocalAvailableModels([]);
        setLocalStatus({
          status: "failure",
          message: typeof data.error === "string" ? data.error : "Connection failed",
        });
        return;
      }

      const models = Array.isArray(data.models)
        ? data.models.filter((item): item is string => typeof item === "string")
        : [];
      setLocalAvailableModels(models);
      setLocalStatus({
        status: "success",
        message: `Connected — ${models.length} models available`,
      });
    } catch {
      setLocalAvailableModels([]);
      setLocalStatus({ status: "failure", message: "Connection failed" });
    }
  }, []);

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
              Configure a local OpenAI-compatible runtime and control visible local models.
            </p>

            <section className="mt-5 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-zinc-100">Enable local models</p>
                  <p className="text-xs text-zinc-500">Allow local runtime models to appear in model selection.</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={localModelsEnabled}
                  onClick={() => void handleLocalEnabledChange(!localModelsEnabled)}
                  disabled={loading}
                  className={`relative h-6 w-11 rounded-full transition-colors ${
                    localModelsEnabled ? "bg-emerald-500" : "bg-zinc-700"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                      localModelsEnabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div className={`mt-5 space-y-4 ${localModelsEnabled ? "" : "pointer-events-none opacity-50"}`}>
                <div className="space-y-2">
                  <label htmlFor="local-runtime" className="text-sm font-medium text-zinc-200">
                    Runtime
                  </label>
                  <select
                    id="local-runtime"
                    value={localRuntime}
                    onChange={(e) => void handleLocalRuntimeChange(parseLocalRuntime(e.target.value))}
                    disabled={loading}
                    className="h-10 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-zinc-600"
                  >
                    {LOCAL_RUNTIME_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {LOCAL_RUNTIME_HELPERS[localRuntime] && (
                    <p className="text-xs text-zinc-500">{LOCAL_RUNTIME_HELPERS[localRuntime]}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label htmlFor="local-endpoint" className="text-sm font-medium text-zinc-200">
                    Endpoint URL
                  </label>
                  <Input
                    id="local-endpoint"
                    value={localEndpoint}
                    onChange={(e) => {
                      void handleLocalEndpointChange(e.target.value);
                    }}
                    placeholder="http://localhost:11434"
                    className="border-zinc-700 bg-zinc-950 text-zinc-100 placeholder:text-zinc-500"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-zinc-700 bg-transparent text-zinc-200 hover:bg-zinc-800"
                    onClick={() => void testLocalConnection()}
                    disabled={localStatus.status === "testing" || loading}
                  >
                    {localStatus.status === "testing" ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-transparent" />
                        Testing...
                      </span>
                    ) : (
                      "Test connection"
                    )}
                  </Button>

                  {localStatus.message && (
                    <p className={localStatus.status === "success" ? "text-sm text-emerald-400" : "text-sm text-red-400"}>
                      {localStatus.message}
                    </p>
                  )}
                </div>

                <div className="rounded-md border border-zinc-800 p-3">
                  <p className="text-sm font-medium text-zinc-200">Visible local models</p>
                  {localStatus.status !== "success" ? (
                    <p className="mt-1 text-xs text-zinc-500">Run connection test to see available models</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {localAvailableModels.map((modelId) => {
                        const visible = !localHiddenModels.has(modelId);
                        return (
                          <div key={modelId} className="flex items-center justify-between gap-3">
                            <span className="text-sm text-zinc-300">{modelId}</span>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={visible}
                              onClick={() => toggleLocalModelVisibility(modelId)}
                              disabled={loading}
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
                  )}
                </div>
              </div>
            </section>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
