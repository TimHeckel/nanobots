import { describe, it, expect } from "vitest";
import { BUILT_IN_BOTS } from "../../src/lib/nanobots/ai-bots/defaults";

describe("ai-bots/defaults", () => {
  it("should export exactly 6 built-in bots", () => {
    expect(BUILT_IN_BOTS).toHaveLength(6);
  });

  it("should have unique names", () => {
    const names = BUILT_IN_BOTS.map((b) => b.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("should include the expected bot names", () => {
    const names = BUILT_IN_BOTS.map((b) => b.name);
    expect(names).toContain("security-scanner");
    expect(names).toContain("code-quality");
    expect(names).toContain("actions-hardening");
    expect(names).toContain("readme-generator");
    expect(names).toContain("architecture-mapper");
    expect(names).toContain("api-doc-generator");
  });

  it("should all be active and built-in", () => {
    for (const bot of BUILT_IN_BOTS) {
      expect(bot.status).toBe("active");
      expect(bot.source).toBe("built-in");
    }
  });

  it("should all have non-empty system prompts", () => {
    for (const bot of BUILT_IN_BOTS) {
      expect(bot.systemPrompt.length).toBeGreaterThan(50);
    }
  });

  it("should all have valid categories", () => {
    const validCategories = ["security", "quality", "docs"];
    for (const bot of BUILT_IN_BOTS) {
      expect(validCategories).toContain(bot.category);
    }
  });

  it("should all have file extensions configured", () => {
    for (const bot of BUILT_IN_BOTS) {
      expect(bot.config.fileExtensions).toBeDefined();
      expect(bot.config.fileExtensions!.length).toBeGreaterThan(0);
      for (const ext of bot.config.fileExtensions!) {
        expect(ext).toMatch(/^\./);
      }
    }
  });

  it("should have reasonable batch sizes", () => {
    for (const bot of BUILT_IN_BOTS) {
      const batchSize = bot.config.maxFilesPerBatch ?? 15;
      expect(batchSize).toBeGreaterThan(0);
      expect(batchSize).toBeLessThanOrEqual(50);
    }
  });

  describe("security-scanner", () => {
    const bot = BUILT_IN_BOTS.find((b) => b.name === "security-scanner")!;

    it("should target broad file types", () => {
      expect(bot.config.fileExtensions).toContain(".ts");
      expect(bot.config.fileExtensions).toContain(".py");
      expect(bot.config.fileExtensions).toContain(".env");
      expect(bot.config.fileExtensions).toContain(".json");
    });

    it("should mention OWASP in the system prompt", () => {
      expect(bot.systemPrompt).toContain("OWASP");
    });
  });

  describe("actions-hardening", () => {
    const bot = BUILT_IN_BOTS.find((b) => b.name === "actions-hardening")!;

    it("should only target workflow files", () => {
      expect(bot.config.fileExtensions).toEqual([".yml", ".yaml"]);
    });

    it("should mention SHA pinning", () => {
      expect(bot.systemPrompt).toContain("SHA");
    });
  });

  describe("readme-generator", () => {
    const bot = BUILT_IN_BOTS.find((b) => b.name === "readme-generator")!;

    it("should have document output format", () => {
      expect(bot.config.outputFormat).toBe("document");
    });

    it("should have a larger batch size for context", () => {
      expect(bot.config.maxFilesPerBatch).toBe(30);
    });
  });
});
