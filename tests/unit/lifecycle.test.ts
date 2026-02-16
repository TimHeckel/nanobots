import { describe, it, expect } from "vitest";
import {
  promoteBot,
  archiveBot,
  canPromote,
} from "../../src/lib/nanobots/ai-bots/lifecycle";
import type {
  BotDefinition,
  TestResult,
} from "../../src/lib/nanobots/ai-bots/types";

function makeBot(overrides: Partial<BotDefinition> = {}): BotDefinition {
  return {
    name: "test-bot",
    description: "Test bot",
    category: "quality",
    systemPrompt: "Analyze.",
    config: { fileExtensions: [".ts"] },
    status: "draft",
    source: "user",
    ...overrides,
  };
}

function makeTestResult(
  overrides: Partial<TestResult> = {},
): TestResult {
  return {
    bot: "test-bot",
    findings: [],
    filesScanned: 10,
    durationMs: 1000,
    success: true,
    ...overrides,
  };
}

describe("ai-bots/lifecycle", () => {
  describe("promoteBot()", () => {
    it("should promote draft to testing", () => {
      const bot = makeBot({ status: "draft" });
      const promoted = promoteBot(bot);
      expect(promoted.status).toBe("testing");
      expect(promoted.promotedAt).toBeDefined();
    });

    it("should promote testing to active", () => {
      const bot = makeBot({ status: "testing" });
      const promoted = promoteBot(bot);
      expect(promoted.status).toBe("active");
      expect(promoted.promotedAt).toBeDefined();
    });

    it("should throw when promoting active bot", () => {
      const bot = makeBot({ status: "active" });
      expect(() => promoteBot(bot)).toThrow(/Cannot promote/);
    });

    it("should throw when promoting archived bot", () => {
      const bot = makeBot({ status: "archived" });
      expect(() => promoteBot(bot)).toThrow(/Cannot promote/);
    });

    it("should not mutate the original bot", () => {
      const bot = makeBot({ status: "draft" });
      const promoted = promoteBot(bot);
      expect(bot.status).toBe("draft");
      expect(promoted.status).toBe("testing");
    });

    it("should set promotedAt as ISO string", () => {
      const bot = makeBot({ status: "draft" });
      const promoted = promoteBot(bot);
      expect(() => new Date(promoted.promotedAt!)).not.toThrow();
    });
  });

  describe("archiveBot()", () => {
    it("should archive an active bot", () => {
      const bot = makeBot({ status: "active" });
      const archived = archiveBot(bot);
      expect(archived.status).toBe("archived");
    });

    it("should archive a draft bot", () => {
      const bot = makeBot({ status: "draft" });
      const archived = archiveBot(bot);
      expect(archived.status).toBe("archived");
    });

    it("should not mutate the original bot", () => {
      const bot = makeBot({ status: "active" });
      archiveBot(bot);
      expect(bot.status).toBe("active");
    });
  });

  describe("canPromote()", () => {
    it("should allow promoting draft with successful test", () => {
      const bot = makeBot({ status: "draft" });
      const results = [makeTestResult({ success: true })];
      expect(canPromote(bot, results)).toBe(true);
    });

    it("should not allow promoting draft without test results", () => {
      const bot = makeBot({ status: "draft" });
      expect(canPromote(bot)).toBe(false);
    });

    it("should not allow promoting draft with no successful tests", () => {
      const bot = makeBot({ status: "draft" });
      const results = [makeTestResult({ success: false })];
      expect(canPromote(bot, results)).toBe(false);
    });

    it("should allow promoting testing with successful shadow runs", () => {
      const bot = makeBot({ status: "testing" });
      const results = [
        makeTestResult({ success: true }),
        makeTestResult({ success: true }),
      ];
      expect(canPromote(bot, results)).toBe(true);
    });

    it("should not allow promoting testing with failed shadow runs", () => {
      const bot = makeBot({ status: "testing" });
      const results = [
        makeTestResult({ success: true }),
        makeTestResult({ success: false }),
      ];
      expect(canPromote(bot, results)).toBe(false);
    });

    it("should not allow promoting active bots", () => {
      const bot = makeBot({ status: "active" });
      expect(canPromote(bot)).toBe(false);
    });

    it("should not allow promoting archived bots", () => {
      const bot = makeBot({ status: "archived" });
      expect(canPromote(bot)).toBe(false);
    });
  });
});
