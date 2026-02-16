import { tool } from "ai";
import { z } from "zod";
import { getSystemPrompt } from "@/lib/db/queries/system-prompts";
import { getRepoByFullName } from "@/lib/db/queries/org-repos";
import { getInstallationOctokit, getRepoTree, getFileContent } from "@/lib/github";
import { getOrgById } from "@/lib/db/queries/organizations";
import { executeBot } from "@/lib/nanobots/ai-bots/engine";
import { getModel } from "@/lib/llm/provider";
import type { BotDefinition } from "@/lib/nanobots/ai-bots/types";

export function testBotToolDef(orgId: string) {
  return tool({
    description:
      "Test a bot against a repository to preview what it would find. Works with bots in any status.",
    inputSchema: z.object({
      botName: z.string().describe("Name of the bot to test"),
      repoName: z
        .string()
        .describe("Full repo name (e.g. 'org/repo') to test against"),
      maxFiles: z
        .number()
        .optional()
        .describe("Max files to test (default 20)"),
    }),
    execute: async ({ botName, repoName, maxFiles }) => {
      // Get the bot's system prompt
      const prompt = await getSystemPrompt(orgId, botName);
      if (!prompt) {
        return { error: `Bot "${botName}" not found. Create it first with createBot.` };
      }

      // Verify repo belongs to org
      const repo = await getRepoByFullName(orgId, repoName);
      if (!repo) {
        return { error: `Repository "${repoName}" not found in your organization.` };
      }

      const org = await getOrgById(orgId);
      if (!org) {
        return { error: "Organization not found." };
      }

      const [owner, repoSlug] = repoName.split("/");

      // Build a minimal BotDefinition
      const botDef: BotDefinition = {
        name: botName,
        description: `Testing ${botName}`,
        category: "security",
        systemPrompt: prompt.prompt_text,
        config: {
          fileExtensions: [".ts", ".tsx", ".js", ".jsx"],
          maxFilesPerBatch: 15,
          maxSteps: 5,
        },
        status: "draft",
      };

      try {
        const octokit = await getInstallationOctokit(
          org.github_installation_id,
        );
        const tree = await getRepoTree(octokit, owner, repoSlug);

        const sourceExts = new Set(botDef.config.fileExtensions ?? []);
        const filesToFetch = tree
          .filter((f) => {
            if (f.size > 100_000) return false;
            if (f.path.includes("node_modules/")) return false;
            const ext = "." + f.path.split(".").pop();
            return sourceExts.has(ext);
          })
          .slice(0, maxFiles ?? 20);

        const files = [];
        for (const f of filesToFetch) {
          try {
            const { content } = await getFileContent(
              octokit,
              owner,
              repoSlug,
              f.path,
            );
            files.push({ path: f.path, content });
          } catch {
            // skip
          }
        }

        const model = getModel();
        const findings = await executeBot(botDef, files, model);

        return {
          success: true,
          filesScanned: files.length,
          findingCount: findings.length,
          findings: findings.slice(0, 10), // Limit for chat display
          message:
            findings.length > 0
              ? `Found ${findings.length} issue${findings.length !== 1 ? "s" : ""}. Review and promote with promotBot if results look good.`
              : "No issues found in the test files.",
        };
      } catch (error) {
        return { error: `Test failed: ${String(error)}` };
      }
    },
  });
}
