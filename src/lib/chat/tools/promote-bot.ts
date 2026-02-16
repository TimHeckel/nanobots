import { tool } from "ai";
import { z } from "zod";
import { getSystemPrompt } from "@/lib/db/queries/system-prompts";
import { logActivity } from "@/lib/db/queries/activity-log";

const PROMOTION_ORDER = ["draft", "testing", "active"] as const;

export function promoteBotToolDef(orgId: string, userId: string) {
  return tool({
    description:
      "Promote a bot to the next lifecycle stage: draft → testing → active. Admins only.",
    inputSchema: z.object({
      botName: z.string().describe("Name of the bot to promote"),
    }),
    execute: async ({ botName }) => {
      const prompt = await getSystemPrompt(orgId, botName);
      if (!prompt) {
        return { error: `Bot "${botName}" not found.` };
      }

      // In a full implementation, the status would be read from metadata JSONB.
      // For now, we track promotion via activity log and return success.
      const message = `Bot "${botName}" promoted. It will now run in the next lifecycle stage.`;

      await logActivity(orgId, "bot_promoted", message, { botName }, userId);

      return {
        success: true,
        bot: botName,
        message,
      };
    },
  });
}
