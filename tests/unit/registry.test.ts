import { describe, it, expect } from "vitest";
import { createRegistry } from "../../src/lib/nanobots/ai-bots/registry";
import { BUILT_IN_BOTS } from "../../src/lib/nanobots/ai-bots/defaults";
import type { BotDefinition } from "../../src/lib/nanobots/ai-bots/types";

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

describe("ai-bots/registry", () => {
  describe("createRegistry()", () => {
    it("should include all built-in bots by default", () => {
      const registry = createRegistry();
      const all = registry.getAll();
      expect(all.length).toBe(BUILT_IN_BOTS.length);
    });

    it("should merge user bots with built-in bots", () => {
      const userBot = makeBot({ name: "custom-scanner" });
      const registry = createRegistry([userBot]);
      const all = registry.getAll();
      expect(all.length).toBe(BUILT_IN_BOTS.length + 1);
    });

    it("should allow user bots to override built-in by name", () => {
      const override = makeBot({
        name: "security-scanner",
        systemPrompt: "Custom prompt",
        source: "user",
      });
      const registry = createRegistry([override]);
      const bot = registry.getByName("security-scanner");
      expect(bot?.systemPrompt).toBe("Custom prompt");
      expect(bot?.source).toBe("user");
      // Total count stays the same since we replaced one
      expect(registry.getAll().length).toBe(BUILT_IN_BOTS.length);
    });
  });

  describe("getByName()", () => {
    it("should find a built-in bot", () => {
      const registry = createRegistry();
      const bot = registry.getByName("security-scanner");
      expect(bot).toBeDefined();
      expect(bot?.name).toBe("security-scanner");
    });

    it("should return undefined for unknown name", () => {
      const registry = createRegistry();
      expect(registry.getByName("nonexistent")).toBeUndefined();
    });
  });

  describe("getByStatus()", () => {
    it("should return only active bots from built-in", () => {
      const registry = createRegistry();
      const active = registry.getByStatus("active");
      expect(active.length).toBe(BUILT_IN_BOTS.length);
    });

    it("should return draft bots when they exist", () => {
      const draft = makeBot({ name: "draft-bot", status: "draft" });
      const registry = createRegistry([draft]);
      const drafts = registry.getByStatus("draft");
      expect(drafts.length).toBe(1);
      expect(drafts[0].name).toBe("draft-bot");
    });

    it("should return empty for statuses with no bots", () => {
      const registry = createRegistry();
      const archived = registry.getByStatus("archived");
      expect(archived).toEqual([]);
    });
  });

  describe("getByCategory()", () => {
    it("should filter by security category", () => {
      const registry = createRegistry();
      const security = registry.getByCategory("security");
      expect(security.length).toBeGreaterThan(0);
      for (const bot of security) {
        expect(bot.category).toBe("security");
      }
    });

    it("should filter by docs category", () => {
      const registry = createRegistry();
      const docs = registry.getByCategory("docs");
      expect(docs.length).toBe(3);
    });
  });

  describe("getActive()", () => {
    it("should return only active bots", () => {
      const draft = makeBot({ name: "draft-bot", status: "draft" });
      const testing = makeBot({ name: "testing-bot", status: "testing" });
      const registry = createRegistry([draft, testing]);
      const active = registry.getActive();
      expect(active.every((b) => b.status === "active")).toBe(true);
      expect(active.length).toBe(BUILT_IN_BOTS.length);
    });
  });

  describe("getTesting()", () => {
    it("should return only testing bots", () => {
      const testing = makeBot({ name: "testing-bot", status: "testing" });
      const registry = createRegistry([testing]);
      const result = registry.getTesting();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("testing-bot");
    });
  });

  describe("add()", () => {
    it("should add a new bot to the registry", () => {
      const registry = createRegistry();
      const initial = registry.getAll().length;

      registry.add(makeBot({ name: "new-bot" }));
      expect(registry.getAll().length).toBe(initial + 1);
      expect(registry.getByName("new-bot")).toBeDefined();
    });
  });

  describe("update()", () => {
    it("should update an existing bot", () => {
      const registry = createRegistry();
      const updated = makeBot({
        name: "security-scanner",
        systemPrompt: "Updated prompt",
      });
      const result = registry.update("security-scanner", updated);
      expect(result).toBe(true);
      expect(registry.getByName("security-scanner")?.systemPrompt).toBe(
        "Updated prompt",
      );
    });

    it("should return false for non-existent bot", () => {
      const registry = createRegistry();
      const result = registry.update("fake", makeBot());
      expect(result).toBe(false);
    });
  });

  describe("remove()", () => {
    it("should remove a bot from the registry", () => {
      const registry = createRegistry();
      const initial = registry.getAll().length;
      const result = registry.remove("security-scanner");
      expect(result).toBe(true);
      expect(registry.getAll().length).toBe(initial - 1);
      expect(registry.getByName("security-scanner")).toBeUndefined();
    });

    it("should return false for non-existent bot", () => {
      const registry = createRegistry();
      expect(registry.remove("fake")).toBe(false);
    });
  });
});
