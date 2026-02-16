import { describe, it, expect } from "vitest";
import type {
  BotDefinition,
  BotStatus,
  ToolDefinition,
  PipelineDefinition,
  BotConfig,
  BotFinding,
  TestResult,
  ShadowResult,
} from "../../src/lib/nanobots/ai-bots/types";

describe("ai-bots/types", () => {
  describe("BotDefinition", () => {
    it("should accept a minimal valid bot definition", () => {
      const bot: BotDefinition = {
        name: "test-bot",
        description: "A test bot",
        category: "security",
        systemPrompt: "You are a test bot.",
        config: {},
        status: "draft",
      };

      expect(bot.name).toBe("test-bot");
      expect(bot.status).toBe("draft");
      expect(bot.tools).toBeUndefined();
      expect(bot.pipeline).toBeUndefined();
    });

    it("should accept a fully populated bot definition", () => {
      const bot: BotDefinition = {
        name: "full-bot",
        description: "A fully configured bot",
        category: "quality",
        systemPrompt: "Analyze code.",
        tools: [
          {
            name: "fetchCVE",
            description: "Check CVEs",
            parameters: {
              packageName: { type: "string", description: "npm package" },
            },
            implementation: "fetch",
            implementationConfig: {
              urlTemplate: "https://api.example.com/cve/{packageName}",
            },
          },
        ],
        pipeline: {
          fileFilter: "*.ts",
          preProcess: "stripComments",
          postProcess: "dedup",
        },
        outputSchema: { type: "object" },
        config: {
          fileExtensions: [".ts", ".js"],
          outputFormat: "findings",
          maxFilesPerBatch: 10,
          maxSteps: 3,
          enabled: true,
        },
        status: "active",
        source: "user",
        createdAt: "2025-01-01T00:00:00Z",
        promotedAt: "2025-01-02T00:00:00Z",
      };

      expect(bot.tools).toHaveLength(1);
      expect(bot.tools![0].name).toBe("fetchCVE");
      expect(bot.config.fileExtensions).toEqual([".ts", ".js"]);
      expect(bot.source).toBe("user");
    });
  });

  describe("BotStatus", () => {
    it("should accept valid statuses", () => {
      const statuses: BotStatus[] = ["draft", "testing", "active", "archived"];
      expect(statuses).toHaveLength(4);
    });
  });

  describe("BotFinding", () => {
    it("should accept a finding with all fields", () => {
      const finding: BotFinding = {
        file: "src/index.ts",
        line: 42,
        severity: "high",
        category: "security",
        description: "Hardcoded API key",
        suggestion: "Use environment variable",
        fixedContent: 'const key = process.env.API_KEY;',
      };

      expect(finding.file).toBe("src/index.ts");
      expect(finding.severity).toBe("high");
    });

    it("should accept a minimal finding", () => {
      const finding: BotFinding = {
        file: "app.js",
        severity: "info",
        category: "general",
        description: "Something noted",
      };

      expect(finding.line).toBeUndefined();
      expect(finding.suggestion).toBeUndefined();
    });
  });

  describe("TestResult", () => {
    it("should represent a successful test", () => {
      const result: TestResult = {
        bot: "test-bot",
        findings: [],
        filesScanned: 10,
        durationMs: 1500,
        success: true,
      };

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should represent a failed test", () => {
      const result: TestResult = {
        bot: "test-bot",
        findings: [],
        filesScanned: 0,
        durationMs: 100,
        success: false,
        error: "API timeout",
      };

      expect(result.success).toBe(false);
      expect(result.error).toBe("API timeout");
    });
  });
});
