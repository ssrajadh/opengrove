import { getSettings } from "@/lib/db";

type ModelsResponse = {
  data?: Array<{ id?: unknown }>;
};

export async function GET(): Promise<Response> {
  const settings = getSettings();
  const endpointValue = settings.local_endpoint;
  const localRuntime = settings.local_runtime;
  void localRuntime;

  if (typeof endpointValue !== "string" || endpointValue.trim() === "") {
    return Response.json({ models: [], error: "No endpoint configured" });
  }

  const endpoint = endpointValue.trim().replace(/\/+$/, "");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(`${endpoint}/v1/models`, {
      method: "GET",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error("Request failed");
    }

    const payload = (await response.json()) as ModelsResponse;
    const models = Array.isArray(payload.data)
      ? payload.data
          .map((entry) => entry.id)
          .filter((id): id is string => typeof id === "string")
      : [];

    return Response.json({ models });
  } catch {
    return Response.json({ models: [], error: "Connection failed" });
  } finally {
    clearTimeout(timeout);
  }
}
