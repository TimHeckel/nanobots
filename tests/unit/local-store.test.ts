import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  saveBot,
  loadBot,
  loadLocalBots,
  deleteBot,
} from "../../cli/bots/local-store";
import type { BotDefinition } from "../../src/lib/nanobots/ai-bots/types";

function makeBot(overrides: Partial<BotDefinition> = {}): BotDefinition {
  return {
    name: "test-bot",
    description: "A test bot",
    category: "quality",
    systemPrompt: "Analyze.",
    config: { fileExtensions: [".ts"] },
    status: "draft",
    source: "user",
    ...overrides,
  };
}

describe("cli/bots/local-store", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nanobots-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("saveBot()", () => {
    it("should create the .nanobots/bots directory and save JSON", async () => {
      const bot = makeBot();
      const path = await saveBot(bot, tempDir);

      expect(path).toContain(".nanobots/bots/test-bot.json");

      const content = await readFile(path, "utf-8");
      const parsed = JSON.parse(content);
      expect(parsed.name).toBe("test-bot");
      expect(parsed.status).toBe("draft");
    });

    it("should overwrite an existing bot file", async () => {
      const bot1 = makeBot({ description: "version 1" });
      await saveBot(bot1, tempDir);

      const bot2 = makeBot({ description: "version 2" });
      await saveBot(bot2, tempDir);

      const loaded = await loadBot("test-bot", tempDir);
      expect(loaded?.description).toBe("version 2");
    });
  });

  describe("loadBot()", () => {
    it("should load a saved bot by name", async () => {
      await saveBot(makeBot(), tempDir);
      const loaded = await loadBot("test-bot", tempDir);
      expect(loaded).toBeDefined();
      expect(loaded?.name).toBe("test-bot");
      expect(loaded?.status).toBe("draft");
    });

    it("should return null for non-existent bot", async () => {
      const loaded = await loadBot("nonexistent", tempDir);
      expect(loaded).toBeNull();
    });
  });

  describe("loadLocalBots()", () => {
    it("should load all bots from directory", async () => {
      await saveBot(makeBot({ name: "bot-a" }), tempDir);
      await saveBot(makeBot({ name: "bot-b" }), tempDir);
      await saveBot(makeBot({ name: "bot-c" }), tempDir);

      const bots = await loadLocalBots(tempDir);
      expect(bots).toHaveLength(3);
      const names = bots.map((b) => b.name).sort();
      expect(names).toEqual(["bot-a", "bot-b", "bot-c"]);
    });

    it("should return empty array when no bots directory exists", async () => {
      const bots = await loadLocalBots(tempDir);
      expect(bots).toEqual([]);
    });

    it("should skip non-JSON files", async () => {
      await saveBot(makeBot({ name: "real-bot" }), tempDir);
      // Write a non-JSON file into the bots dir
      const { writeFile } = await import("node:fs/promises");
      await writeFile(
        join(tempDir, ".nanobots/bots/README.txt"),
        "not a bot",
        "utf-8",
      );

      const bots = await loadLocalBots(tempDir);
      expect(bots).toHaveLength(1);
      expect(bots[0].name).toBe("real-bot");
    });
  });

  describe("deleteBot()", () => {
    it("should delete an existing bot", async () => {
      await saveBot(makeBot(), tempDir);
      const result = await deleteBot("test-bot", tempDir);
      expect(result).toBe(true);

      const loaded = await loadBot("test-bot", tempDir);
      expect(loaded).toBeNull();
    });

    it("should return false when bot does not exist", async () => {
      const result = await deleteBot("nonexistent", tempDir);
      expect(result).toBe(false);
    });
  });
});
