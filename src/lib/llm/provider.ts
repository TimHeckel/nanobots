import { createOpenAI } from "@ai-sdk/openai";
import { wrapLanguageModel, type LanguageModelMiddleware } from "ai";

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

const DEFAULT_MODEL = "anthropic/claude-sonnet-4.5";

/**
 * Middleware that fixes OpenRouter returning finishReason "stop" instead of
 * "tool-calls" when tool calls are present in the response. Without this fix,
 * the AI SDK's agentic loop won't execute tools or continue iterating.
 */
export const fixFinishReasonMiddleware: LanguageModelMiddleware = {
  specificationVersion: "v3",

  wrapGenerate: async ({ doGenerate }) => {
    const result = await doGenerate();

    const hasToolCalls = result.content.some((c) => c.type === "tool-call");
    if (hasToolCalls && result.finishReason.unified === "stop") {
      return {
        ...result,
        finishReason: {
          unified: "tool-calls" as const,
          raw: result.finishReason.raw,
        },
      };
    }

    return result;
  },

  wrapStream: async ({ doStream }) => {
    const streamResult = await doStream();
    let sawToolCall = false;

    const transform = new TransformStream({
      transform(chunk, controller) {
        if (
          chunk.type === "tool-input-start" ||
          chunk.type === "tool-call"
        ) {
          sawToolCall = true;
        }

        if (
          chunk.type === "finish" &&
          sawToolCall &&
          chunk.finishReason.unified === "stop"
        ) {
          controller.enqueue({
            ...chunk,
            finishReason: {
              unified: "tool-calls" as const,
              raw: chunk.finishReason.raw,
            },
          });
          return;
        }

        controller.enqueue(chunk);
      },
    });

    return {
      ...streamResult,
      stream: streamResult.stream.pipeThrough(transform),
    };
  },
};

/**
 * Get the default model for SaaS operations.
 */
export function getModel(modelId: string = DEFAULT_MODEL) {
  return wrapLanguageModel({
    model: openrouter(modelId),
    middleware: fixFinishReasonMiddleware,
  });
}

/**
 * Check if the LLM provider is configured.
 */
export function isLLMAvailable(): boolean {
  return !!process.env.OPENROUTER_API_KEY;
}
