import { NextRequest, NextResponse } from "next/server";
import {
  getSettings,
  isSupportedSettingKey,
  upsertSettings,
  type SettingsMap,
} from "@/lib/db";

export const dynamic = "force-dynamic";

function toApiSettings(raw: SettingsMap): Record<string, string | string[]> {
  const normalized: Record<string, string | string[]> = {};

  for (const [key, value] of Object.entries(raw)) {
    if (typeof value !== "string") continue;

    if (key === "hidden_models") {
      try {
        const parsed = JSON.parse(value);
        normalized[key] = Array.isArray(parsed)
          ? parsed.filter((item): item is string => typeof item === "string")
          : [];
      } catch {
        normalized[key] = [];
      }
      continue;
    }

    normalized[key] = value;
  }

  return normalized;
}

export async function GET() {
  const settings = getSettings();
  return NextResponse.json(toApiSettings(settings));
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Request body must be a JSON object" },
        { status: 400 }
      );
    }

    const updates: SettingsMap = {};

    for (const [key, value] of Object.entries(body)) {
      if (!isSupportedSettingKey(key)) continue;

      if (key === "hidden_models") {
        if (Array.isArray(value)) {
          updates[key] = JSON.stringify(
            value.filter((item): item is string => typeof item === "string")
          );
        } else if (typeof value === "string") {
          try {
            const parsed = JSON.parse(value);
            updates[key] = JSON.stringify(
              Array.isArray(parsed)
                ? parsed.filter((item): item is string => typeof item === "string")
                : []
            );
          } catch {
            return NextResponse.json(
              { error: "hidden_models must be an array of strings" },
              { status: 400 }
            );
          }
        } else {
          return NextResponse.json(
            { error: "hidden_models must be an array of strings" },
            { status: 400 }
          );
        }
        continue;
      }

      if (typeof value === "string") {
        updates[key] = value;
      } else if (value == null) {
        updates[key] = "";
      } else {
        updates[key] = String(value);
      }
    }

    upsertSettings(updates);

    const settings = getSettings();
    return NextResponse.json(toApiSettings(settings));
  } catch (err) {
    console.error("Settings API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update settings" },
      { status: 500 }
    );
  }
}
