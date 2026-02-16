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
import { resolve } from "node:path";

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

  // Run bots
  const results = await runAllBots(bots, files, provider, flags.verbose);

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
  const totalFindings = results.reduce(
    (sum, r) => sum + r.findings.length,
    0,
  );
  return totalFindings > 0 ? 1 : 0;
}
