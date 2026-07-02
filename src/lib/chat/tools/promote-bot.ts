import { z } from "zod";

const BOT_STATUSES = {
  "evidence-bot": "draft",
  "policy-bot": "testing",
  "monitoring-bot": "active",
} as const;

export function promoteBotToolDef(orgId: string, userId: string) {
  return {
    description: "Promote a control-room bot to the next lifecycle stage",
    inputSchema: z.object({
      botName: z.string(),
    }),
    execute: async ({ botName }: { botName: string }) => {
      const currentStatus = BOT_STATUSES[botName as keyof typeof BOT_STATUSES];

      if (!currentStatus) {
        return { error: `Bot "${botName}" not found.` };
      }

      if (currentStatus === "active") {
        return { error: `Bot "${botName}" is already active.` };
      }

      const nextStatus = currentStatus === "draft" ? "testing" : "active";

      return {
        success: true,
        orgId,
        userId,
        bot: botName,
        fromStatus: currentStatus,
        toStatus: nextStatus,
        message: `Bot "${botName}" promoted from ${currentStatus} to ${nextStatus}.`,
      };
    },
  };
}
