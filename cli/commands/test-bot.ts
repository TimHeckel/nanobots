import { createOpenAI } from "@ai-sdk/openai";
import { resolve } from "node:path";
import { testBot } from "../../src/lib/nanobots/ai-bots/lifecycle";
import { loadBot } from "../bots/local-store";
import { createRegistry } from "../../src/lib/nanobots/ai-bots/registry";
import { loadLocalBots } from "../bots/local-store";
import { walkFiles } from "../file-provider";
import type { ProviderConfig } from "../provider";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";
const CYAN = "\x1b[36m";

const SEVERITY_COLORS: Record<string, string> = {
  critical: RED,
  high: RED,
  medium: YELLOW,
  low: DIM,
  info: CYAN,
};

export async function testBotCommand(
  botName: string,
  targetDir: string,
  provider: ProviderConfig,
): Promise<number> {
  if (!botName) {
    process.stderr.write(
      "\n  Usage: nanobots test <bot-name> [directory]\n\n",
    );
    return 1;
  }

  if (!provider.apiKey) {
    process.stderr.write(
      "\n  Error: No API key configured.\n" +
        "  Set OPENROUTER_API_KEY or run `nanobots auth`.\n\n",
    );
    return 1;
  }

  const dir = resolve(targetDir || ".");

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

  process.stderr.write(
    `\n  ${BOLD}Testing ${CYAN}${bot.name}${RESET}${BOLD} against ${dir}...${RESET}\n`,
  );

  // Walk files
  const { files } = await walkFiles(dir, {
    extensions: bot.config.fileExtensions,
  });

  if (files.length === 0) {
    process.stderr.write(
      `\n  No matching files found for extensions: ${(bot.config.fileExtensions ?? []).join(", ")}\n\n`,
    );
    return 0;
  }

  process.stderr.write(`  ${DIM}Found ${files.length} files to analyze${RESET}\n`);

  const openai = createOpenAI({
    baseURL: provider.baseUrl,
    apiKey: provider.apiKey,
  });
  const model = openai.chat(provider.model);

  const result = await testBot(bot, files, model);

  if (!result.success) {
    process.stderr.write(`\n  ${RED}Test failed: ${result.error}${RESET}\n\n`);
    return 1;
  }

  process.stderr.write(
    `\n  ${GREEN}Test complete${RESET} in ${result.durationMs}ms\n`,
  );
  process.stderr.write(
    `  Found ${BOLD}${result.findings.length}${RESET} finding${result.findings.length !== 1 ? "s" : ""}:\n\n`,
  );

  for (const finding of result.findings) {
    const color = SEVERITY_COLORS[finding.severity] ?? DIM;
    const loc = finding.line ? `:${finding.line}` : "";
    process.stderr.write(
      `    ${color}${finding.severity.toUpperCase()}${RESET} ${finding.file}${loc}\n`,
    );
    process.stderr.write(`      ${finding.description}\n`);
    if (finding.suggestion) {
      process.stderr.write(`      ${DIM}${finding.suggestion}${RESET}\n`);
    }
    process.stderr.write("\n");
  }

  if (bot.status === "draft") {
    process.stderr.write(
      `  ${DIM}Promote with: nanobots promote ${bot.name}${RESET}\n\n`,
    );
  }

  return 0;
}
