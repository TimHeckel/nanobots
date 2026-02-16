import { tool } from "ai";
import { z } from "zod";
import { getSystemPrompt } from "@/lib/db/queries/system-prompts";
import { upsertBotConfig } from "@/lib/db/queries/bot-configs";
import { logActivity } from "@/lib/db/queries/activity-log";


const PROMOTION_ORDER = ["draft", "testing", "active"] as const;
type BotStatus = (typeof PROMOTION_ORDER)[number];

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

      // Determine current status from activity log history

      // Determine current status from recent activity
      const currentStatus = await getCurrentStatus(orgId, botName);
      const currentIdx = PROMOTION_ORDER.indexOf(currentStatus);

      if (currentIdx === -1 || currentIdx >= PROMOTION_ORDER.length - 1) {
        return {
          error: currentStatus === "active"
            ? `Bot "${botName}" is already active.`
            : `Bot "${botName}" cannot be promoted from "${currentStatus}".`,
        };
      }

      const nextStatus = PROMOTION_ORDER[currentIdx + 1];
      const message = `Bot "${botName}" promoted from ${currentStatus} to ${nextStatus}.`;

      // If promoting to active, enable in bot_configs so it runs on scans
      if (nextStatus === "active") {
        await upsertBotConfig(orgId, botName, true);
      }

      await logActivity(orgId, "bot_promoted", message, {
        botName,
        fromStatus: currentStatus,
        toStatus: nextStatus,
      }, userId);

      return {
        success: true,
        bot: botName,
        fromStatus: currentStatus,
        toStatus: nextStatus,
        message,
      };
    },
  });
}

async function getCurrentStatus(orgId: string, botName: string): Promise<BotStatus> {
  // Check activity log for the most recent promotion event
  const { sql } = await import("@/lib/db/index");
  const { rows } = await sql<{ metadata: Record<string, unknown> }>`
    SELECT metadata FROM activity_log
    WHERE org_id = ${orgId}
      AND event_type = 'bot_promoted'
      AND metadata->>'botName' = ${botName}
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (rows.length > 0 && rows[0].metadata?.toStatus) {
    return rows[0].metadata.toStatus as BotStatus;
  }

  // No promotion history — it's a draft
  return "draft";
}
