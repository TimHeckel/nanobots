import { getAllBots, getBotsByCategory } from "../bots/index";
import { createRegistry } from "../../src/lib/nanobots/ai-bots/registry";
import { loadLocalBots } from "../bots/local-store";
import type { BotDefinition } from "../../src/lib/nanobots/ai-bots/types";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";

const CATEGORY_ICONS: Record<string, string> = {
  security: "🔒",
  quality: "🧹",
  docs: "📄",
};

const STATUS_ICONS: Record<string, string> = {
  active: "✅",
  testing: "🧪",
  draft: "📝",
  archived: "📦",
};

export async function listCommand(showAll: boolean = false): Promise<number> {
  const userBots = await loadLocalBots(".");
  const registry = createRegistry(userBots);

  const bots = showAll ? registry.getAll() : registry.getActive();

  const grouped = new Map<string, BotDefinition[]>();

  for (const bot of bots) {
    const list = grouped.get(bot.category) ?? [];
    list.push(bot);
    grouped.set(bot.category, list);
  }

  process.stdout.write(`\n${BOLD}Available Bots${RESET}`);
  if (showAll) {
    process.stdout.write(` ${DIM}(all statuses)${RESET}`);
  }
  process.stdout.write("\n");

  for (const [category, categoryBots] of grouped) {
    const icon = CATEGORY_ICONS[category] ?? "🤖";
    process.stdout.write(
      `\n  ${icon} ${BOLD}${category}${RESET}\n`,
    );

    for (const bot of categoryBots) {
      const statusIcon = STATUS_ICONS[bot.status] ?? "";
      const source = bot.source === "user" ? ` ${YELLOW}(custom)${RESET}` : "";
      process.stdout.write(
        `    ${CYAN}${bot.name}${RESET}  ${statusIcon} ${DIM}${bot.description}${RESET}${source}\n`,
      );
    }
  }

  process.stdout.write("\n");

  if (!showAll) {
    const totalAll = registry.getAll().length;
    const totalActive = bots.length;
    if (totalAll > totalActive) {
      process.stdout.write(
        `  ${DIM}${totalAll - totalActive} more bot${totalAll - totalActive !== 1 ? "s" : ""} hidden. Use --all to show all statuses.${RESET}\n\n`,
      );
    }
  }

  return 0;
}
