import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai/index.mjs";
import {
  insertMessage,
  getFullHistory,
  createConversation,
} from "@/lib/db";
import { buildContextWithRAG } from "@/lib/rag";
import { embedAndStoreOverflow } from "@/lib/embeddings";
import { randomUUID } from "crypto";

const GEMINI_MODELS: Record<string, string> = {
  "gemini-2.0-flash": "gemini-2.0-flash",
  "gemini-2.0-flash-lite": "gemini-2.0-flash-lite",
  "gemini-3-flash-preview": "gemini-3-flash-preview",
  "gemini-3-pro-preview": "gemini-3-pro-preview",
};

const OPENAI_MODELS = ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini"];

/** Context window sizes in tokens per model. */
const MODEL_CONTEXT_TOKENS: Record<string, number> = {
  // Gemini
  "gemini-2.0-flash":       1_048_576,
  "gemini-2.0-flash-lite":  1_048_576,
  "gemini-3-flash-preview": 1_048_576,
  "gemini-3-pro-preview":   1_048_576,
  // OpenAI
  "gpt-4o":      128_000,
  "gpt-4o-mini": 128_000,
  "gpt-4.1":     1_047_576,
  "gpt-4.1-mini":1_047_576,
};

const RESPONSE_BUFFER_TOKENS = 4096;

function isOpenAIModel(modelKey: string): boolean {
  return OPENAI_MODELS.includes(modelKey) || modelKey.startsWith("gpt-");
}

function streamLine(obj: object): string {
  return JSON.stringify(obj) + "\n";
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      conversationId: string | null;
      message: string;
      model: string;
    };
    const { conversationId, message: messageText, model: modelKey } = body;

    const id = conversationId ?? randomUUID();

    if (!conversationId) {
      const modelId = isOpenAIModel(modelKey)
        ? modelKey
        : GEMINI_MODELS[modelKey] ?? "gemini-2.0-flash";
      await createConversation(id, modelId, messageText.slice(0, 80) || "New chat");
    }

    const userMsgId = randomUUID();
    await insertMessage(userMsgId, id, "user", messageText);

    const allMessages = await getFullHistory(id);
    const contextLimit = MODEL_CONTEXT_TOKENS[modelKey] ?? 128_000;
    const { ragContext, recentMessages, overflow } = await buildContextWithRAG(
      id, allMessages, messageText, contextLimit, RESPONSE_BUFFER_TOKENS,
    );

    // Build provider-ready history with optional RAG preamble
    const history: Array<{ role: "user" | "assistant"; content: string }> = [];
    if (ragContext) {
      history.push(
        { role: "user", content: "Relevant context from earlier in this conversation:\n" + ragContext },
        { role: "assistant", content: "Understood, I have that context." },
      );
    }
    for (const m of recentMessages) {
      history.push({ role: m.role, content: m.content });
    }

    const assistantMsgId = randomUUID();

    const encoder = new TextEncoder();
    let fullText = "";

    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj: object) => {
          controller.enqueue(encoder.encode(streamLine(obj)));
        };

        try {
          if (isOpenAIModel(modelKey)) {
            const apiKey = process.env.OPENAI_API_KEY;
            if (!apiKey) {
              send({ type: "error", error: "OPENAI_API_KEY not set. Add it to .env" });
              controller.close();
              return;
            }
            const openai = new OpenAI({ apiKey });
            const input = history.map((m) => ({
              role: m.role === "user" ? ("user" as const) : ("assistant" as const),
              content: m.content,
            }));
            const streamResponse = await openai.responses.create({
              model: modelKey,
              input,
              stream: true,
              tools: [
                {
                  type: "web_search_preview",
                  search_context_size: "medium",
                },
              ],
            });
            for await (const event of streamResponse) {
              if (
                event.type === "response.output_text.delta" &&
                event.delta
              ) {
                fullText += event.delta;
                send({ type: "chunk", text: event.delta });
              }
            }
          } else {
            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) {
              send({ type: "error", error: "GEMINI_API_KEY not set. Add it to .env" });
              controller.close();
              return;
            }
            const modelId = GEMINI_MODELS[modelKey] ?? "gemini-2.0-flash";
            const ai = new GoogleGenAI({ apiKey });
            const contents = history.map((m) => ({
              role: m.role === "user" ? "user" : "model",
              parts: [{ text: m.content }],
            }));
            const streamResult = await ai.models.generateContentStream({
              model: modelId,
              contents,
              config: {
                tools: [{ googleSearch: {} }],
              },
            });
            for await (const chunk of streamResult) {
              const text = chunk.text ?? "";
              if (text) {
                fullText += text;
                send({ type: "chunk", text });
              }
            }
          }

          const text = fullText.trim();
          await insertMessage(assistantMsgId, id, "assistant", text);

          // Fire-and-forget: embed overflow messages for future RAG retrieval
          if (overflow.length > 0) {
            embedAndStoreOverflow(id, overflow).catch((err) =>
              console.error("Background embedding failed:", err),
            );
          }

          send({
            type: "done",
            conversationId: id,
            message: { role: "assistant" as const, content: text, id: assistantMsgId },
          });
        } catch (err) {
          console.error("Chat API error:", err);
          send({
            type: "error",
            error: err instanceof Error ? err.message : "Chat failed",
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Chat API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Chat failed" },
      { status: 500 }
    );
  }
}
