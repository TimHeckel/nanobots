import { describe, it, expect, vi, beforeEach } from "vitest";

// We test the internal helper logic by importing the module and using
// the public executeBot function with a mock model.

// Since executeBot calls generateText from 'ai', we mock it.
vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    generateText: vi.fn(),
    stepCountIs: vi.fn(() => () => false),
  };
});

import { executeBot, type RepoFile } from "../../src/lib/nanobots/ai-bots/engine";
import { generateText } from "ai";
import type { BotDefinition } from "../../src/lib/nanobots/ai-bots/types";

const mockGenerateText = vi.mocked(generateText);

function makeBot(overrides: Partial<BotDefinition> = {}): BotDefinition {
  return {
    name: "test-bot",
    description: "Test bot",
    category: "quality",
    systemPrompt: "You are a test bot. Return findings as JSON.",
    config: {
      fileExtensions: [".ts"],
      maxFilesPerBatch: 5,
    },
    status: "active",
    ...overrides,
  };
}

function makeFiles(count: number, ext: string = ".ts"): RepoFile[] {
  return Array.from({ length: count }, (_, i) => ({
    path: `src/file${i}${ext}`,
    content: `// content of file ${i}\nconsole.log("hello");`,
  }));
}

describe("ai-bots/engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("executeBot()", () => {
    it("should return empty array when no files match extensions", async () => {
      const bot = makeBot({ config: { fileExtensions: [".py"] } });
      const files = makeFiles(5, ".ts");
      const model = {} as any;

      const findings = await executeBot(bot, files, model);
      expect(findings).toEqual([]);
      expect(mockGenerateText).not.toHaveBeenCalled();
    });

    it("should call generateText with correct system prompt", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: '{"findings": []}',
      } as any);

      const bot = makeBot();
      const files = makeFiles(2);
      const model = {} as any;

      await executeBot(bot, files, model);

      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({
          model,
          system: bot.systemPrompt,
        }),
      );
    });

    it("should parse findings from LLM response", async () => {
      const response = JSON.stringify({
        findings: [
          {
            file: "src/file0.ts",
            line: 2,
            severity: "medium",
            category: "console-pollution",
            description: "console.log found",
            suggestion: "Remove it",
          },
        ],
      });

      mockGenerateText.mockResolvedValueOnce({ text: response } as any);

      const bot = makeBot();
      const findings = await executeBot(bot, makeFiles(2), {} as any);

      expect(findings).toHaveLength(1);
      expect(findings[0].file).toBe("src/file0.ts");
      expect(findings[0].severity).toBe("medium");
      expect(findings[0].description).toBe("console.log found");
    });

    it("should handle markdown-fenced JSON response", async () => {
      const response = '```json\n{"findings": [{"file": "a.ts", "severity": "low", "category": "test", "description": "test"}]}\n```';

      mockGenerateText.mockResolvedValueOnce({ text: response } as any);

      const bot = makeBot();
      const findings = await executeBot(bot, makeFiles(1), {} as any);
      expect(findings).toHaveLength(1);
    });

    it("should handle invalid JSON gracefully", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: "this is not json at all",
      } as any);

      const bot = makeBot();
      const findings = await executeBot(bot, makeFiles(1), {} as any);
      expect(findings).toEqual([]);
    });

    it("should batch files according to maxFilesPerBatch", async () => {
      // 8 files with batch size 5 = 2 batches
      mockGenerateText
        .mockResolvedValueOnce({ text: '{"findings": []}' } as any)
        .mockResolvedValueOnce({ text: '{"findings": []}' } as any);

      const bot = makeBot({ config: { fileExtensions: [".ts"], maxFilesPerBatch: 5 } });
      await executeBot(bot, makeFiles(8), {} as any);

      expect(mockGenerateText).toHaveBeenCalledTimes(2);
    });

    it("should default invalid severity to medium", async () => {
      const response = JSON.stringify({
        findings: [
          {
            file: "a.ts",
            severity: "EXTREME",
            category: "test",
            description: "test",
          },
        ],
      });

      mockGenerateText.mockResolvedValueOnce({ text: response } as any);

      const bot = makeBot();
      const findings = await executeBot(bot, makeFiles(1), {} as any);
      expect(findings[0].severity).toBe("medium");
    });

    it("should handle generateText throwing an error", async () => {
      mockGenerateText.mockRejectedValueOnce(new Error("API down"));

      const bot = makeBot();
      // Should not throw — errors are caught per batch
      const findings = await executeBot(bot, makeFiles(1), {} as any);
      expect(findings).toEqual([]);
    });

    it("should merge findings from multiple batches", async () => {
      mockGenerateText
        .mockResolvedValueOnce({
          text: '{"findings": [{"file":"a.ts","severity":"high","category":"x","description":"one"}]}',
        } as any)
        .mockResolvedValueOnce({
          text: '{"findings": [{"file":"b.ts","severity":"low","category":"y","description":"two"}]}',
        } as any);

      const bot = makeBot({ config: { fileExtensions: [".ts"], maxFilesPerBatch: 2 } });
      const findings = await executeBot(bot, makeFiles(4), {} as any);
      expect(findings).toHaveLength(2);
    });
  });
});
