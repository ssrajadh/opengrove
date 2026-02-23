import { NextRequest, NextResponse } from "next/server";

type Provider = "openai" | "gemini" | "anthropic";

type TestResponse = {
  success: boolean;
  message: string;
};

function parseProvider(value: unknown): Provider | null {
  if (value === "openai" || value === "gemini" || value === "anthropic") {
    return value;
  }
  return null;
}

function timeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

async function testOpenAI(apiKey: string): Promise<TestResponse> {
  const res = await fetch("https://api.openai.com/v1/models?limit=1", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    signal: timeoutSignal(10_000),
  });

  if (res.ok) return { success: true, message: "OpenAI connection successful" };

  const text = await res.text();
  return {
    success: false,
    message: `OpenAI test failed (${res.status}): ${text.slice(0, 120) || "Unknown error"}`,
  };
}

async function testGemini(apiKey: string): Promise<TestResponse> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
    {
      method: "GET",
      signal: timeoutSignal(10_000),
    }
  );

  if (res.ok) return { success: true, message: "Google Gemini connection successful" };

  const text = await res.text();
  return {
    success: false,
    message: `Gemini test failed (${res.status}): ${text.slice(0, 120) || "Unknown error"}`,
  };
}

async function testAnthropic(apiKey: string): Promise<TestResponse> {
  const res = await fetch("https://api.anthropic.com/v1/models", {
    method: "GET",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    signal: timeoutSignal(10_000),
  });

  if (res.ok) return { success: true, message: "Anthropic connection successful" };

  const text = await res.text();
  return {
    success: false,
    message: `Anthropic test failed (${res.status}): ${text.slice(0, 120) || "Unknown error"}`,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { provider?: unknown; apiKey?: unknown };
    const provider = parseProvider(body.provider);
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";

    if (!provider) {
      return NextResponse.json(
        { success: false, message: "Invalid provider" },
        { status: 400 }
      );
    }
    if (!apiKey) {
      return NextResponse.json(
        { success: false, message: "API key is required" },
        { status: 400 }
      );
    }

    let result: TestResponse;
    if (provider === "openai") {
      result = await testOpenAI(apiKey);
    } else if (provider === "gemini") {
      result = await testGemini(apiKey);
    } else {
      result = await testAnthropic(apiKey);
    }

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        message: err instanceof Error ? err.message : "Connection test failed",
      },
      { status: 500 }
    );
  }
}
