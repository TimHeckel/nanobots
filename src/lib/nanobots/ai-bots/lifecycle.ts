import type { LanguageModel } from "ai";
import { executeBot, type RepoFile } from "./engine";
import type { BotEventCallback } from "./events";
import type { BotDefinition, BotStatus, TestResult, ShadowResult } from "./types";

export async function testBot(
  bot: BotDefinition,
  files: RepoFile[],
  model: LanguageModel,
  onEvent?: BotEventCallback,
): Promise<TestResult> {
  const start = Date.now();

  try {
    const findings = await executeBot(bot, files, model, onEvent);

    return {
      bot: bot.name,
      findings,
      filesScanned: files.length,
      durationMs: Date.now() - start,
      success: true,
    };
  } catch (error) {
    return {
      bot: bot.name,
      findings: [],
      filesScanned: 0,
      durationMs: Date.now() - start,
      success: false,
      error: String(error),
    };
  }
}

const PROMOTION_ORDER: BotStatus[] = ["draft", "testing", "active"];

export function promoteBot(bot: BotDefinition): BotDefinition {
  const currentIndex = PROMOTION_ORDER.indexOf(bot.status);

  if (currentIndex === -1 || currentIndex >= PROMOTION_ORDER.length - 1) {
    throw new Error(
      `Cannot promote bot "${bot.name}" from status "${bot.status}"`,
    );
  }

  const nextStatus = PROMOTION_ORDER[currentIndex + 1];

  return {
    ...bot,
    status: nextStatus,
    promotedAt: new Date().toISOString(),
  };
}

export function archiveBot(bot: BotDefinition): BotDefinition {
  return {
    ...bot,
    status: "archived",
  };
}

export async function shadowRun(
  bot: BotDefinition,
  files: RepoFile[],
  model: LanguageModel,
  onEvent?: BotEventCallback,
): Promise<ShadowResult> {
  const start = Date.now();
  const findings = await executeBot(bot, files, model, onEvent);

  return {
    bot: bot.name,
    findings,
    filesScanned: files.length,
    durationMs: Date.now() - start,
    timestamp: Date.now(),
  };
}

export function canPromote(bot: BotDefinition, testResults?: TestResult[]): boolean {
  if (bot.status === "draft") {
    // Need at least 1 successful test
    return !!testResults && testResults.some((r) => r.success);
  }

  if (bot.status === "testing") {
    // Need shadow runs with acceptable results
    return !!testResults && testResults.length >= 1 && testResults.every((r) => r.success);
  }

  return false;
}
