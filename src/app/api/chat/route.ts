import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import {
  insertMessage,
  getMessages,
  getConversation,
  createConversation,
} from "@/lib/db";
import { randomUUID } from "crypto";

const MODELS: Record<string, string> = {
  "gemini-2.0-flash": "gemini-2.0-flash",
  "gemini-2.0-flash-lite": "gemini-2.0-flash-lite",
  "gemini-3-flash-preview": "gemini-3-flash-preview",
  "gemini-3-pro-preview": "gemini-3-pro-preview",
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      conversationId: string | null;
      message: string;
      model: string;
    };
    const { conversationId, message: messageText, model: modelKey } = body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY not set. Add it to .env.local" },
        { status: 500 }
      );
    }

    const modelId = MODELS[modelKey] ?? "gemini-2.0-flash";
    const id = conversationId ?? randomUUID();

    if (!conversationId) {
      await createConversation(id, modelId, messageText.slice(0, 80) || "New chat");
    }

    const userMsgId = randomUUID();
    await insertMessage(userMsgId, id, "user", messageText);

    const history = await getMessages(id);
    const ai = new GoogleGenAI({ apiKey });

    const contents = history.map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    }));

    const response = await ai.models.generateContent({
      model: modelId,
      contents,
    });

    const text = response.text ?? "";

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
