import { resolve } from "node:path";
import { promoteBot } from "../../src/lib/nanobots/ai-bots/lifecycle";
import { loadBot, saveBot } from "../bots/local-store";
import { createRegistry } from "../../src/lib/nanobots/ai-bots/registry";
import { loadLocalBots } from "../bots/local-store";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const GREEN = "\x1b[32m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";

const STATUS_ICONS: Record<string, string> = {
  draft: "📝",
  testing: "🧪",
  active: "✅",
  archived: "📦",
};

export async function promoteCommand(
  botName: string,
  rootDir: string = ".",
): Promise<number> {
  if (!botName) {
    process.stderr.write(
      "\n  Usage: nanobots promote <bot-name>\n\n",
    );
    return 1;
  }

  const dir = resolve(rootDir);

  // Try local store first, then registry
  let bot = await loadBot(botName, dir);
  if (!bot) {
    const userBots = await loadLocalBots(dir);
    const registry = createRegistry(userBots);
    bot = registry.getByName(botName) ?? null;
  }

  if (!bot) {
    process.stderr.write(`\n  Error: Bot "${botName}" not found\n\n`);
    return 1;
  }

  const fromIcon = STATUS_ICONS[bot.status] ?? "❓";
  const fromStatus = bot.status;

  try {
    const promoted = promoteBot(bot);
    const toIcon = STATUS_ICONS[promoted.status] ?? "❓";

    // Save if it's a user bot in local store
    if (bot.source !== "built-in") {
      await saveBot(promoted, dir);
    }

    process.stderr.write(
      `\n  ${GREEN}Promoted!${RESET} ${CYAN}${bot.name}${RESET}\n`,
    );
    process.stderr.write(
      `  ${fromIcon} ${fromStatus} → ${toIcon} ${BOLD}${promoted.status}${RESET}\n\n`,
    );

    if (promoted.status === "testing") {
      process.stderr.write(
        `  ${DIM}Bot will run in shadow mode on scans.${RESET}\n`,
      );
      process.stderr.write(
        `  ${DIM}Promote again after reviewing results: nanobots promote ${bot.name}${RESET}\n\n`,
      );
    } else if (promoted.status === "active") {
      process.stderr.write(
        `  ${DIM}Bot is now active and will run on scans.${RESET}\n\n`,
      );
    }

    return 0;
  } catch (error) {
    process.stderr.write(`\n  Error: ${error}\n\n`);
    return 1;
  }
}
