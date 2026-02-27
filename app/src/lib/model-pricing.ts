/**
 * Per-token pricing (USD) for supported models.
 * Prices are per 1 million tokens.
 */

type ModelPricing = {
  inputPerMillion: number;
  outputPerMillion: number;
};

const MODEL_PRICING: Record<string, ModelPricing> = {
  // OpenAI
  "gpt-4o":       { inputPerMillion: 2.50,  outputPerMillion: 10.00 },
  "gpt-4o-mini":  { inputPerMillion: 0.15,  outputPerMillion: 0.60 },
  "gpt-4.1":      { inputPerMillion: 2.00,  outputPerMillion: 8.00 },
  "gpt-4.1-mini": { inputPerMillion: 0.40,  outputPerMillion: 1.60 },
  // Google Gemini
  "gemini-2.0-flash":       { inputPerMillion: 0.10,  outputPerMillion: 0.40 },
  "gemini-2.0-flash-lite":  { inputPerMillion: 0.075, outputPerMillion: 0.30 },
  "gemini-3-flash-preview": { inputPerMillion: 0.15,  outputPerMillion: 0.60 },
  "gemini-3-pro-preview":   { inputPerMillion: 1.25,  outputPerMillion: 10.00 },
};

/**
 * Calculate the cost (USD) for a given model and token counts.
 * Returns 0 for unknown models (e.g., local models).
 */
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;
  return (
    (inputTokens / 1_000_000) * pricing.inputPerMillion +
    (outputTokens / 1_000_000) * pricing.outputPerMillion
  );
}
