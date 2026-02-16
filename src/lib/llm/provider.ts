import { createOpenAI } from "@ai-sdk/openai";

/**
 * Shared model factory for the SaaS backend.
 * Uses OpenRouter via @ai-sdk/openai — same provider path as the CLI.
 *
 * Requires OPENROUTER_API_KEY env var.
 */
const openrouter = createOpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY ?? "",
});

const DEFAULT_MODEL = "anthropic/claude-sonnet-4-5-20250929";

/**
 * Get the default model for SaaS operations.
 */
export function getModel(modelId: string = DEFAULT_MODEL) {
  return openrouter(modelId);
}

/**
 * Check if the LLM provider is configured.
 */
export function isLLMAvailable(): boolean {
  return !!process.env.OPENROUTER_API_KEY;
}
