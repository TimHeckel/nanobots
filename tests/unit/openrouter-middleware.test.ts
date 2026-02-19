import { describe, it, expect } from "vitest";
import { fixFinishReasonMiddleware } from "../../src/lib/llm/provider";

describe("fixFinishReasonMiddleware — wrapGenerate", () => {
  const wrapGenerate = fixFinishReasonMiddleware.wrapGenerate!;

  it("fixes finishReason when 'stop' + tool calls present", async () => {
    const result = await wrapGenerate({
      doGenerate: async () => ({
        content: [
          { type: "tool-call" as const, toolCallId: "1", toolName: "listBots", input: "{}" },
        ],
        finishReason: { unified: "stop" as const, raw: "stop" },
        usage: {
          inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 5, text: 5, reasoning: undefined },
        },
        warnings: [],
      }),
      doStream: async () => ({ stream: new ReadableStream() }),
      params: {} as never,
      model: {} as never,
    });

    expect(result.finishReason.unified).toBe("tool-calls");
    expect(result.finishReason.raw).toBe("stop");
  });

  it("leaves finishReason alone when no tool calls", async () => {
    const result = await wrapGenerate({
      doGenerate: async () => ({
        content: [
          { type: "text" as const, text: "Hello", id: "1" },
        ],
        finishReason: { unified: "stop" as const, raw: "stop" },
        usage: {
          inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 5, text: 5, reasoning: undefined },
        },
        warnings: [],
      }),
      doStream: async () => ({ stream: new ReadableStream() }),
      params: {} as never,
      model: {} as never,
    });

    expect(result.finishReason.unified).toBe("stop");
  });

  it("leaves finishReason alone when already 'tool-calls'", async () => {
    const result = await wrapGenerate({
      doGenerate: async () => ({
        content: [
          { type: "tool-call" as const, toolCallId: "1", toolName: "listBots", input: "{}" },
        ],
        finishReason: { unified: "tool-calls" as const, raw: "tool_calls" },
        usage: {
          inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 5, text: 5, reasoning: undefined },
        },
        warnings: [],
      }),
      doStream: async () => ({ stream: new ReadableStream() }),
      params: {} as never,
      model: {} as never,
    });

    expect(result.finishReason.unified).toBe("tool-calls");
    expect(result.finishReason.raw).toBe("tool_calls");
  });
});

describe("fixFinishReasonMiddleware — wrapStream", () => {
  const wrapStream = fixFinishReasonMiddleware.wrapStream!;

  function makeStream(chunks: Array<Record<string, unknown>>): ReadableStream {
    return new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(chunk);
        }
        controller.close();
      },
    });
  }

  async function collectStream(stream: ReadableStream): Promise<Array<Record<string, unknown>>> {
    const reader = stream.getReader();
    const results: Array<Record<string, unknown>> = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      results.push(value);
    }
    return results;
  }

  it("fixes finish chunk when tool-input-start chunks were seen", async () => {
    const result = await wrapStream({
      doStream: async () => ({
        stream: makeStream([
          { type: "tool-input-start", id: "1", toolName: "listBots" },
          { type: "tool-input-delta", id: "1", delta: "{}" },
          { type: "tool-input-end", id: "1" },
          {
            type: "finish",
            finishReason: { unified: "stop", raw: "stop" },
            usage: {
              inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
              outputTokens: { total: 5, text: 5, reasoning: undefined },
            },
          },
        ]),
      }),
      doGenerate: async () => ({}) as never,
      params: {} as never,
      model: {} as never,
    });

    const chunks = await collectStream(result.stream);
    const finishChunk = chunks.find((c) => c.type === "finish") as {
      type: string;
      finishReason: { unified: string; raw: string };
    };

    expect(finishChunk.finishReason.unified).toBe("tool-calls");
    expect(finishChunk.finishReason.raw).toBe("stop");
  });

  it("leaves finish chunk alone when no tool chunks seen", async () => {
    const result = await wrapStream({
      doStream: async () => ({
        stream: makeStream([
          { type: "text-start", id: "1" },
          { type: "text-delta", id: "1", delta: "Hello" },
          { type: "text-end", id: "1" },
          {
            type: "finish",
            finishReason: { unified: "stop", raw: "stop" },
            usage: {
              inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
              outputTokens: { total: 5, text: 5, reasoning: undefined },
            },
          },
        ]),
      }),
      doGenerate: async () => ({}) as never,
      params: {} as never,
      model: {} as never,
    });

    const chunks = await collectStream(result.stream);
    const finishChunk = chunks.find((c) => c.type === "finish") as {
      type: string;
      finishReason: { unified: string; raw: string };
    };

    expect(finishChunk.finishReason.unified).toBe("stop");
  });
});
