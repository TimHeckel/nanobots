import { describe, it, expect, vi } from "vitest";

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    generateText: vi.fn(),
  };
});

import { createBotFromDescription } from "../../src/lib/nanobots/ai-bots/bot-creator";
import { generateText } from "ai";

const mockGenerateText = vi.mocked(generateText);

describe("ai-bots/bot-creator", () => {
  describe("createBotFromDescription()", () => {
    it("should create a valid bot definition from LLM response", async () => {
      const llmResponse = JSON.stringify({
        name: "todo-finder",
        description: "Finds TODO comments in source code",
        category: "quality",
        systemPrompt: "You find TODO comments and report them as findings.",
        config: {
          fileExtensions: [".ts", ".tsx", ".js"],
          outputFormat: "findings",
          maxFilesPerBatch: 20,
        },
      });

      mockGenerateText.mockResolvedValueOnce({ text: llmResponse } as any);

      const bot = await createBotFromDescription(
        "Find TODO comments",
        {} as any,
      );

      expect(bot.name).toBe("todo-finder");
      expect(bot.description).toBe("Finds TODO comments in source code");
      expect(bot.category).toBe("quality");
      expect(bot.status).toBe("draft");
      expect(bot.source).toBe("user");
      expect(bot.createdAt).toBeDefined();
      expect(bot.config.fileExtensions).toEqual([".ts", ".tsx", ".js"]);
    });

    it("should handle markdown-fenced JSON from LLM", async () => {
      const llmResponse = '```json\n{"name":"fenced-bot","description":"test","category":"security","systemPrompt":"Analyze."}\n```';

      mockGenerateText.mockResolvedValueOnce({ text: llmResponse } as any);

      const bot = await createBotFromDescription("test bot", {} as any);
      expect(bot.name).toBe("fenced-bot");
    });

    it("should apply defaults for missing config fields", async () => {
      const llmResponse = JSON.stringify({
        name: "minimal-bot",
        description: "Minimal",
        systemPrompt: "Analyze code.",
      });

      mockGenerateText.mockResolvedValueOnce({ text: llmResponse } as any);

      const bot = await createBotFromDescription("minimal", {} as any);
      expect(bot.config.fileExtensions).toEqual([".ts", ".tsx", ".js", ".jsx"]);
      expect(bot.config.maxFilesPerBatch).toBe(15);
      expect(bot.config.maxSteps).toBe(5);
    });

    it("should throw when LLM returns no system prompt", async () => {
      const llmResponse = JSON.stringify({
        name: "bad-bot",
        description: "No prompt",
        systemPrompt: "",
      });

      mockGenerateText.mockResolvedValueOnce({ text: llmResponse } as any);

      await expect(
        createBotFromDescription("bad bot", {} as any),
      ).rejects.toThrow("system prompt");
    });

    it("should throw when LLM returns invalid JSON", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: "I cannot create a bot for you.",
      } as any);

      await expect(
        createBotFromDescription("bad input", {} as any),
      ).rejects.toThrow();
    });

    it("should always set status to draft and source to user", async () => {
      const llmResponse = JSON.stringify({
        name: "sneaky-bot",
        description: "Tries to be active",
        systemPrompt: "Analyze.",
        status: "active",
        source: "built-in",
      });

      mockGenerateText.mockResolvedValueOnce({ text: llmResponse } as any);

      const bot = await createBotFromDescription("sneaky", {} as any);
      expect(bot.status).toBe("draft");
      expect(bot.source).toBe("user");
    });
  });
});
