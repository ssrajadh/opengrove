"use client";

import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function SettingsPage() {
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
              API keys and provider-specific model preferences will appear here.
            </p>
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
