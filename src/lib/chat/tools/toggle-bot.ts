import { tool } from "ai";
import { z } from "zod";
import { toggleBot } from "@/lib/db/queries/bot-configs";
import { logActivity } from "@/lib/db/queries/activity-log";

export function toggleBotToolDef(orgId: string, userId: string, role: string) {
  return tool({
    description: "Enable or disable a nanobot",
    inputSchema: z.object({
      botName: z.string().describe("The name of the bot to toggle"),
      enabled: z.boolean().describe("Whether to enable or disable the bot"),
    }),
    execute: async ({ botName, enabled }) => {
      if (role !== "admin") {
        return { error: "Only admins can enable or disable bots." };
      }

      const result = await toggleBot(orgId, botName, enabled);
      if (!result) {
        return { error: `Bot "${botName}" not found.` };
      }

      await logActivity(
        orgId,
        "bot.toggled",
        `${enabled ? "Enabled" : "Disabled"} bot: ${botName}`,
        { botName, enabled },
        userId
      );

      return {
        success: true,
        botName: result.bot_name,
        enabled: result.enabled,
      };
    },
  });
}
