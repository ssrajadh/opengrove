import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import {
  insertMessage,
  getMessages,
  createConversation,
} from "@/lib/db";
import { randomUUID } from "crypto";

const GEMINI_MODELS: Record<string, string> = {
  "gemini-2.0-flash": "gemini-2.0-flash",
  "gemini-2.0-flash-lite": "gemini-2.0-flash-lite",
  "gemini-3-flash-preview": "gemini-3-flash-preview",
  "gemini-3-pro-preview": "gemini-3-pro-preview",
};

const OPENAI_MODELS = ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini"];

function isOpenAIModel(modelKey: string): boolean {
  return OPENAI_MODELS.includes(modelKey) || modelKey.startsWith("gpt-");
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

    const history = await getMessages(id);

    let text: string;

    if (isOpenAIModel(modelKey)) {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
          return NextResponse.json(
            { error: "OPENAI_API_KEY not set. Add it to .env" },
            { status: 500 }
          );
        }
        const openai = new OpenAI({ apiKey });
        const input = history.map((m) => ({
          role: m.role === "user" ? ("user" as const) : ("assistant" as const),
          content: m.content,
          type: "message" as const,
        }));
        const response = await openai.responses.create({
          model: modelKey,
          input,
          tools: [{ type: "web_search_preview", search_context_size: "medium" }],
        });
        text = (response.output_text ?? "").trim();
      } else {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          return NextResponse.json(
            { error: "GEMINI_API_KEY not set. Add it to .env" },
            { status: 500 }
          );
        }
        const modelId = GEMINI_MODELS[modelKey] ?? "gemini-2.0-flash";
        const ai = new GoogleGenAI({ apiKey });
        const contents = history.map((m) => ({
          role: m.role === "user" ? "user" : "model",
          parts: [{ text: m.content }],
        }));
        const response = await ai.models.generateContent({
          model: modelId,
          contents,
          config: {
            tools: [{ googleSearch: {} }],
          },
        });
        text = response.text ?? "";
      }

    const assistantMsgId = randomUUID();
    await insertMessage(assistantMsgId, id, "assistant", text);

    return NextResponse.json({
      conversationId: id,
      message: { role: "assistant" as const, content: text, id: assistantMsgId },
    });
  } catch (err) {
    console.error("Chat API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Chat failed" },
      { status: 500 }
    );
  }
}
