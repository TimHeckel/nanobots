import { createRegistry } from "../../src/lib/nanobots/ai-bots/registry";
import { loadLocalBots } from "../bots/local-store";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const CYAN = "\x1b[36m";

const STATUS_ICONS: Record<string, string> = {
  active: "✅",
  testing: "🧪",
  draft: "📝",
  archived: "📦",
};

export async function describeCommand(botName: string): Promise<number> {
  const userBots = await loadLocalBots(".");
  const registry = createRegistry(userBots);

  if (!botName) {
    const allNames = registry.getAll().map((b) => b.name);
    process.stderr.write(
      "\n  Usage: nanobots describe <bot-name>\n" +
        `  Available bots: ${allNames.join(", ")}\n\n`,
    );
    return 1;
  }

  const bot = registry.getByName(botName);
  if (!bot) {
    const allNames = registry.getAll().map((b) => b.name);
    process.stderr.write(
      `\n  Error: Unknown bot "${botName}"\n` +
        `  Available bots: ${allNames.join(", ")}\n\n`,
    );
    return 1;
  }

  const statusIcon = STATUS_ICONS[bot.status] ?? "";

  process.stdout.write(`\n${BOLD}${bot.name}${RESET}\n`);
  process.stdout.write(`${DIM}${bot.description}${RESET}\n\n`);
  process.stdout.write(`  ${BOLD}Category:${RESET}    ${bot.category}\n`);
  process.stdout.write(`  ${BOLD}Status:${RESET}      ${statusIcon} ${bot.status}\n`);
  process.stdout.write(`  ${BOLD}Source:${RESET}      ${bot.source ?? "built-in"}\n`);
  process.stdout.write(
    `  ${BOLD}Extensions:${RESET}  ${(bot.config.fileExtensions ?? []).join(", ")}\n`,
  );
  process.stdout.write(
    `  ${BOLD}Batch size:${RESET}  ${bot.config.maxFilesPerBatch ?? 15} files per LLM call\n`,
  );

  if (bot.tools && bot.tools.length > 0) {
    process.stdout.write(`  ${BOLD}Tools:${RESET}       ${bot.tools.map((t) => t.name).join(", ")}\n`);
  }

  process.stdout.write(`\n${BOLD}System Prompt:${RESET}\n`);
  process.stdout.write(`${CYAN}${bot.systemPrompt}${RESET}\n\n`);

  return 0;
}
