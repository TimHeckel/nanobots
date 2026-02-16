import type { BotDefinition, BotStatus } from "./types";
import { BUILT_IN_BOTS } from "./defaults";

export interface BotRegistry {
  getAll(): BotDefinition[];
  getByName(name: string): BotDefinition | undefined;
  getByStatus(status: BotStatus): BotDefinition[];
  getByCategory(category: string): BotDefinition[];
  getActive(): BotDefinition[];
  getTesting(): BotDefinition[];
  add(bot: BotDefinition): void;
  update(name: string, bot: BotDefinition): boolean;
  remove(name: string): boolean;
}

export function createRegistry(
  userBots: BotDefinition[] = [],
): BotRegistry {
  const bots = new Map<string, BotDefinition>();

  // Load built-in bots first
  for (const bot of BUILT_IN_BOTS) {
    bots.set(bot.name, bot);
  }

  // User bots override built-in by name
  for (const bot of userBots) {
    bots.set(bot.name, bot);
  }

  return {
    getAll() {
      return [...bots.values()];
    },

    getByName(name: string) {
      return bots.get(name);
    },

    getByStatus(status: BotStatus) {
      return [...bots.values()].filter((b) => b.status === status);
    },

    getByCategory(category: string) {
      return [...bots.values()].filter((b) => b.category === category);
    },

    getActive() {
      return [...bots.values()].filter((b) => b.status === "active");
    },

    getTesting() {
      return [...bots.values()].filter((b) => b.status === "testing");
    },

    add(bot: BotDefinition) {
      bots.set(bot.name, bot);
    },

    update(name: string, bot: BotDefinition) {
      if (!bots.has(name)) return false;
      bots.delete(name);
      bots.set(bot.name, bot);
      return true;
    },

    remove(name: string) {
      return bots.delete(name);
    },
  };
}
