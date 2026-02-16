import { readFile, writeFile, readdir, mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import type { BotDefinition } from "../../src/lib/nanobots/ai-bots/types";

const BOTS_DIR = ".nanobots/bots";

async function ensureDir(dir: string): Promise<void> {
  try {
    await mkdir(dir, { recursive: true });
  } catch {
    // Already exists
  }
}

function botsPath(rootDir: string): string {
  return join(rootDir, BOTS_DIR);
}

export async function loadLocalBots(
  rootDir: string = ".",
): Promise<BotDefinition[]> {
  const dir = botsPath(rootDir);
  try {
    const entries = await readdir(dir);
    const bots: BotDefinition[] = [];

    for (const entry of entries) {
      if (!entry.endsWith(".json")) continue;
      try {
        const content = await readFile(join(dir, entry), "utf-8");
        bots.push(JSON.parse(content));
      } catch {
        // Skip invalid files
      }
    }

    return bots;
  } catch {
    return [];
  }
}

export async function saveBot(
  bot: BotDefinition,
  rootDir: string = ".",
): Promise<string> {
  const dir = botsPath(rootDir);
  await ensureDir(dir);

  const filePath = join(dir, `${bot.name}.json`);
  await writeFile(filePath, JSON.stringify(bot, null, 2), "utf-8");
  return filePath;
}

export async function loadBot(
  name: string,
  rootDir: string = ".",
): Promise<BotDefinition | null> {
  const filePath = join(botsPath(rootDir), `${name}.json`);
  try {
    const content = await readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export async function deleteBot(
  name: string,
  rootDir: string = ".",
): Promise<boolean> {
  const filePath = join(botsPath(rootDir), `${name}.json`);
  try {
    await unlink(filePath);
    return true;
  } catch {
    return false;
  }
}
