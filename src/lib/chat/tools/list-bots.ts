import { tool } from "ai";
import { z } from "zod";
import { getBotConfigs } from "@/lib/db/queries/bot-configs";

const BOT_DESCRIPTIONS: Record<string, string> = {
  "console-cleanup": "Remove console.log/debug statements",
  "unused-imports": "Remove imports that aren't referenced",
  "actions-updater": "Update deprecated GitHub Actions",
  "secret-scanner": "Detect hardcoded secrets and API keys",
  "actions-security": "Pin GitHub Actions to SHA digests",
  "dead-exports": "Remove exports nothing imports",
  "llm-security": "OWASP LLM Top 10 vulnerability detection",
};

export function listBotsToolDef(orgId: string) {
  return tool({
    description: "List all nanobots with their enabled/disabled status",
    inputSchema: z.object({}),
    execute: async () => {
      const configs = await getBotConfigs(orgId);
      return configs.map((c) => ({
        name: c.bot_name,
        enabled: c.enabled,
        description: BOT_DESCRIPTIONS[c.bot_name] ?? "Unknown bot",
      }));
    },
  });
}
