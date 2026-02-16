import type { BotDefinition } from "../../src/lib/nanobots/ai-bots/types";
import { BUILT_IN_BOTS } from "../../src/lib/nanobots/ai-bots/defaults";
import { createRegistry } from "../../src/lib/nanobots/ai-bots/registry";
import { loadLocalBots } from "./local-store";

// Re-export shared modules
export { BUILT_IN_BOTS } from "../../src/lib/nanobots/ai-bots/defaults";
export { createRegistry } from "../../src/lib/nanobots/ai-bots/registry";
export { loadLocalBots, saveBot, loadBot, deleteBot } from "./local-store";

/**
 * Get all bots: built-in + local user bots.
 * Mirrors the old ALL_BOTS pattern but now powered by the registry.
 */
export async function getAllBots(
  rootDir: string = ".",
): Promise<BotDefinition[]> {
  const userBots = await loadLocalBots(rootDir);
  const registry = createRegistry(userBots);
  return registry.getAll();
}

/**
 * Synchronous access to just the built-in bots.
 */
export const ALL_BOTS = BUILT_IN_BOTS;

export function getBotByName(name: string): BotDefinition | undefined {
  return BUILT_IN_BOTS.find((b) => b.name === name);
}

export function getBotsByCategory(category: string): BotDefinition[] {
  return BUILT_IN_BOTS.filter((b) => b.category === category);
}
