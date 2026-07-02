import { z } from "zod";

const ACTIVITY_FEED = [
  {
    eventType: "evidence.updated",
    summary: "GitHub evidence synced for CC6.1",
    createdAt: "2026-03-26T10:00:00.000Z",
    metadata: { controlId: "CC6.1" },
  },
  {
    eventType: "exception.opened",
    summary: "Missing screenshot evidence for CC8.1",
    createdAt: "2026-03-26T11:00:00.000Z",
    metadata: { controlId: "CC8.1" },
  },
] as const;

export function showActivityToolDef(orgId: string) {
  return {
    description: "Show recent control-room activity feed",
    inputSchema: z.object({
      limit: z.number().optional().default(10),
    }),
    execute: async ({ limit = 10 }: { limit?: number }) =>
      ACTIVITY_FEED.slice(0, limit).map((entry) => ({
        orgId,
        ...entry,
      })),
  };
}
