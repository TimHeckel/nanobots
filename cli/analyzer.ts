import type { BotDefinition, BotFinding } from "../src/lib/nanobots/ai-bots/types";
import { executeBot, type RepoFile } from "../src/lib/nanobots/ai-bots/engine";
import { createOpenAI } from "@ai-sdk/openai";
import type { ProviderConfig } from "./provider";
import type { BotEventCallback } from "../src/lib/nanobots/ai-bots/events";

export { type RepoFile } from "../src/lib/nanobots/ai-bots/engine";

export interface AnalyzerResult {
  bot: string;
  findings: BotFinding[];
  filesScanned: number;
  error?: string;
}

export async function runBot(
  bot: BotDefinition,
  files: RepoFile[],
  provider: ProviderConfig,
  verbose: boolean = false,
  onEvent?: BotEventCallback,
): Promise<AnalyzerResult> {
  const filtered = files.filter((f) => {
    if (!bot.config.fileExtensions || bot.config.fileExtensions.length === 0) return true;
    const dot = f.path.lastIndexOf(".");
    if (dot === -1) return false;
    return bot.config.fileExtensions.includes(f.path.slice(dot).toLowerCase());
  });

  if (filtered.length === 0) {
    return { bot: bot.name, findings: [], filesScanned: 0 };
  }

  if (verbose) {
    process.stderr.write(
      `  [${bot.name}] analyzing ${filtered.length} files...\n`,
    );
  }

  const openai = createOpenAI({
    baseURL: provider.baseUrl,
    apiKey: provider.apiKey,
  });
  const model = openai.chat(provider.model);

  try {
    const findings = await executeBot(bot, filtered, model, onEvent);

    if (verbose) {
      process.stderr.write(
        `  [${bot.name}] found ${findings.length} findings\n`,
      );
    }

    return {
      bot: bot.name,
      findings,
      filesScanned: filtered.length,
    };
  } catch (error) {
    if (verbose) {
      process.stderr.write(`  [${bot.name}] error: ${error}\n`);
    }
    return {
      bot: bot.name,
      findings: [],
      filesScanned: filtered.length,
      error: String(error),
    };
  }
}

export async function runAllBots(
  bots: BotDefinition[],
  files: RepoFile[],
  provider: ProviderConfig,
  verbose: boolean = false,
  onEvent?: BotEventCallback,
): Promise<AnalyzerResult[]> {
  const results: AnalyzerResult[] = [];

  for (const bot of bots) {
    const result = await runBot(bot, files, provider, verbose, onEvent);
    results.push(result);
  }

  return results;
}
