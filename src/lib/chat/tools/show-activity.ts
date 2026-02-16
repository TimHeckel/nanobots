import { tool } from "ai";
import { z } from "zod";
import { getRecentActivity } from "@/lib/db/queries/activity-log";

export function showActivityToolDef(orgId: string) {
  return tool({
    description: "Show recent activity feed",
    inputSchema: z.object({
      limit: z
        .number()
        .optional()
        .default(10)
        .describe("Number of activity entries to return (default 10)"),
    }),
    execute: async ({ limit }) => {
      const entries = await getRecentActivity(orgId, limit);
      return entries.map((e) => ({
        eventType: e.event_type,
        summary: e.summary,
        createdAt: e.created_at,
        metadata: e.metadata,
      }));
    },
  });
}
