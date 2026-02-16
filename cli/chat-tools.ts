import { tool } from "ai";
import { z } from "zod";
import { resolve } from "node:path";
import { createRegistry } from "../src/lib/nanobots/ai-bots/registry";
import { loadLocalBots, saveBot } from "./bots/local-store";
import { createBotFromDescription } from "../src/lib/nanobots/ai-bots/bot-creator";
import { runAllBots, runBot } from "./analyzer";
import { walkFiles } from "./file-provider";
import type { ProviderConfig } from "./provider";
import type { LanguageModel } from "ai";

export function createChatTools(
  rootDir: string,
  provider: ProviderConfig,
  model: LanguageModel
) {
  return {
    listBots: tool({
      description: "List all available bots (built-in + custom) with their status and category",
      inputSchema: z.object({}),
      execute: async () => {
        const userBots = await loadLocalBots(rootDir);
        const registry = createRegistry(userBots);
        const bots = registry.getAll();

        return {
          bots: bots.map((b) => ({
            name: b.name,
            description: b.description,
            category: b.category,
            status: b.status,
            source: b.source ?? "built-in",
          })),
        };
      },
    }),

    describeBot: tool({
      description: "Get full details about a specific bot including its system prompt and configuration",
      inputSchema: z.object({
        botName: z.string().describe("Name of the bot to describe"),
      }),
      execute: async ({ botName }) => {
        const userBots = await loadLocalBots(rootDir);
        const registry = createRegistry(userBots);
        const bot = registry.getByName(botName);

        if (!bot) {
          return { error: `Bot "${botName}" not found.` };
        }

        return {
          name: bot.name,
          description: bot.description,
          category: bot.category,
          status: bot.status,
          source: bot.source ?? "built-in",
          fileExtensions: bot.config.fileExtensions,
          maxFilesPerBatch: bot.config.maxFilesPerBatch,
          systemPrompt: bot.systemPrompt,
          tools: bot.tools?.map((t) => t.name) ?? [],
        };
      },
    }),

    createBot: tool({
      description: "Create a new custom bot from a natural language description. The bot is saved locally as a draft.",
      inputSchema: z.object({
        description: z.string().describe("Description of what the bot should scan for"),
      }),
      execute: async ({ description }) => {
        try {
          const bot = await createBotFromDescription(description, model);
          const filePath = await saveBot(bot, rootDir);

          return {
            success: true,
            bot: {
              name: bot.name,
              description: bot.description,
              category: bot.category,
              status: bot.status,
            },
            savedTo: filePath,
            message: `Bot "${bot.name}" created as draft. Test it with testBot, then promote with the CLI.`,
          };
        } catch (err) {
          return { error: `Failed to create bot: ${err instanceof Error ? err.message : String(err)}` };
        }
      },
    }),

    testBot: tool({
      description: "Test a bot against local files in the current directory to preview what it would find",
      inputSchema: z.object({
        botName: z.string().describe("Name of the bot to test"),
        directory: z.string().optional().describe("Directory to test against (defaults to current directory)"),
      }),
      execute: async ({ botName, directory }) => {
        const dir = resolve(directory ?? rootDir);
        const userBots = await loadLocalBots(rootDir);
        const registry = createRegistry(userBots);
        const bot = registry.getByName(botName);

        if (!bot) {
          return { error: `Bot "${botName}" not found.` };
        }

        const { files } = await walkFiles(dir, {
          extensions: bot.config.fileExtensions,
        });

        if (files.length === 0) {
          return {
            success: true,
            filesScanned: 0,
            findingCount: 0,
            findings: [],
            message: "No matching files found.",
          };
        }

        const result = await runBot(bot, files, provider);

        return {
          success: true,
          filesScanned: result.filesScanned,
          findingCount: result.findings.length,
          findings: result.findings.slice(0, 15),
          message: result.findings.length > 0
            ? `Found ${result.findings.length} issue(s).`
            : "No issues found.",
        };
      },
    }),

    scan: tool({
      description: "Run all active bots against local files to scan for issues",
      inputSchema: z.object({
        directory: z.string().optional().describe("Directory to scan (defaults to current directory)"),
        category: z.string().optional().describe("Filter by category: security, quality, docs"),
        botName: z.string().optional().describe("Run a specific bot only"),
      }),
      execute: async ({ directory, category, botName }) => {
        const dir = resolve(directory ?? rootDir);
        const userBots = await loadLocalBots(rootDir);
        const registry = createRegistry(userBots);

        let bots;
        if (botName) {
          const bot = registry.getByName(botName);
          if (!bot) return { error: `Bot "${botName}" not found.` };
          bots = [bot];
        } else if (category) {
          bots = registry.getByCategory(category);
          if (bots.length === 0) return { error: `No bots in category "${category}".` };
        } else {
          bots = registry.getActive();
        }

        const { files } = await walkFiles(dir);

        if (files.length === 0) {
          return { success: true, botsRun: 0, totalFindings: 0, results: [], message: "No files to scan." };
        }

        const results = await runAllBots(bots, files, provider);
        const totalFindings = results.reduce((sum, r) => sum + r.findings.length, 0);

        return {
          success: true,
          botsRun: results.length,
          totalFindings,
          results: results.map((r) => ({
            bot: r.bot,
            findingCount: r.findings.length,
            findings: r.findings.slice(0, 5),
          })),
          message: `Scanned with ${results.length} bot(s): ${totalFindings} total finding(s).`,
        };
      },
    }),
  };
}
