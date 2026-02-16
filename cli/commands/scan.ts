import crypto from "crypto";
import type { ParsedFlags } from "../flags";
import { loadConfig } from "../config";
import { walkFiles } from "../file-provider";
import { defaultProviderConfig, type ProviderConfig } from "../provider";
import { getAllBots, getBotByName, getBotsByCategory } from "../bots/index";
import { createRegistry } from "../../src/lib/nanobots/ai-bots/registry";
import { loadLocalBots } from "../bots/local-store";
import { runAllBots } from "../analyzer";
import { formatTerminal, formatJSON, printScanHeader } from "../output";
import type { BotDefinition } from "../../src/lib/nanobots/ai-bots/types";
import { writeFile } from "node:fs/promises";
import { resolve, basename } from "node:path";
import type { BotEvent, BotEventCallback } from "../../src/lib/nanobots/ai-bots/events";
import { withScanId } from "../../src/lib/nanobots/ai-bots/events";

function stderrHandler(json: boolean): BotEventCallback {
  return (event: BotEvent) => {
    if (json) return;
    switch (event.type) {
      case "scan.started":
        process.stderr.write(`\n  Scanning with ${event.botCount} bots across ${event.fileCount} files...\n\n`);
        break;
      case "bot.started":
        process.stderr.write(`  [${event.botName}] analyzing ${event.fileCount} files...\n`);
        break;
      case "bot.completed":
        process.stderr.write(`  [${event.botName}] done: ${event.findingCount} findings in ${event.durationMs}ms\n`);
        break;
      case "bot.error":
        process.stderr.write(`  [${event.botName}] error: ${event.error}\n`);
        break;
      case "scan.completed":
        process.stderr.write(`\n  Scan complete: ${event.totalFindings} findings in ${event.durationMs}ms\n`);
        break;
    }
  };
}

function remoteHandler(nanobotsKey: string): BotEventCallback {
  return (event: BotEvent) => {
    fetch("https://nanobots.sh/api/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${nanobotsKey}`,
      },
      body: JSON.stringify(event),
    }).catch(() => {});
  };
}

function composeHandlers(...handlers: BotEventCallback[]): BotEventCallback {
  return (event: BotEvent) => {
    for (const handler of handlers) {
      handler(event);
    }
  };
}

export async function scanCommand(flags: ParsedFlags): Promise<number> {
  const targetDir = resolve(flags.args[0] ?? ".");
  const startTime = Date.now();

  // Load config
  const config = await loadConfig(targetDir);

  // Build provider config
  const provider: ProviderConfig = {
    ...defaultProviderConfig(),
    apiKey: config.apiKey || process.env.OPENROUTER_API_KEY || "",
    model: flags.model ?? config.model,
  };

  if (!provider.apiKey) {
    process.stderr.write(
      "\n  Error: No API key configured.\n" +
        "  Set OPENROUTER_API_KEY environment variable or run `nanobots auth`.\n" +
        "  Get a free key at https://openrouter.ai/keys\n\n",
    );
    return 1;
  }

  // Load all bots (built-in + local user bots)
  const userBots = await loadLocalBots(targetDir);
  const registry = createRegistry(userBots);

  // Select bots
  let bots: BotDefinition[];

  if (flags.bot) {
    const bot = registry.getByName(flags.bot);
    if (!bot) {
      const allNames = registry.getAll().map((b) => b.name);
      process.stderr.write(`\n  Error: Unknown bot "${flags.bot}"\n`);
      process.stderr.write(
        `  Available bots: ${allNames.join(", ")}\n\n`,
      );
      return 1;
    }
    bots = [bot];
  } else if (flags.bots) {
    bots = registry.getByCategory(flags.bots);
    if (bots.length === 0) {
      process.stderr.write(
        `\n  Error: Unknown category "${flags.bots}"\n` +
          `  Available categories: security, quality, docs\n\n`,
      );
      return 1;
    }
  } else {
    // Default: only active bots
    bots = registry.getActive();
  }

  // Remove disabled bots
  if (config.disabledBots.length > 0) {
    const disabled = new Set(config.disabledBots);
    bots = bots.filter((b) => !disabled.has(b.name));
  }

  // Walk filesystem
  const { files, allPaths } = await walkFiles(targetDir, {
    ignorePaths: config.ignorePaths,
  });

  if (!flags.json) {
    printScanHeader(provider.model, allPaths.length, files.length);
  }

  // Build event handlers
  const scanId = crypto.randomUUID();
  const handlers: BotEventCallback[] = [stderrHandler(!!flags.json)];
  if (config.nanobotsKey) {
    handlers.push(remoteHandler(config.nanobotsKey));
  }
  const onEvent = withScanId(scanId, composeHandlers(...handlers));

  // Emit scan.started
  onEvent({
    type: "scan.started",
    timestamp: new Date().toISOString(),
    scanId: "",
    botCount: bots.length,
    fileCount: files.length,
    repo: basename(targetDir),
  });

  // Run bots
  const scanStart = Date.now();
  const results = await runAllBots(bots, files, provider, flags.verbose, onEvent);

  // Emit scan.completed
  const totalFindings = results.reduce((sum, r) => sum + r.findings.length, 0);
  onEvent({
    type: "scan.completed",
    timestamp: new Date().toISOString(),
    scanId: "",
    totalFindings,
    durationMs: Date.now() - scanStart,
  });

  // Output results
  if (flags.json) {
    process.stdout.write(formatJSON(results) + "\n");
  } else {
    process.stdout.write(formatTerminal(results, provider.model, startTime) + "\n\n");
  }

  // Handle --fix: write fixedContent back to disk
  if (flags.fix) {
    let fixCount = 0;
    for (const result of results) {
      for (const finding of result.findings) {
        if (finding.fixedContent && finding.file) {
          const filePath = resolve(targetDir, finding.file);
          try {
            await writeFile(filePath, finding.fixedContent, "utf-8");
            fixCount++;
            if (!flags.json) {
              process.stderr.write(`  Fixed: ${finding.file}\n`);
            }
          } catch (error) {
            process.stderr.write(
              `  Failed to fix ${finding.file}: ${error}\n`,
            );
          }
        }
      }
    }
    if (fixCount > 0 && !flags.json) {
      process.stderr.write(`\n  Applied ${fixCount} fix${fixCount !== 1 ? "es" : ""}\n\n`);
    }
  }

  // Exit code: 1 if any findings (for CI)
  return totalFindings > 0 ? 1 : 0;
}
