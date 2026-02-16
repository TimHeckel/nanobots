import { tool } from "ai";
import { z } from "zod";
import { getStats } from "@/lib/db/queries/scan-results";

export function showStatsToolDef(orgId: string) {
  return tool({
    description: "Show aggregate scan statistics",
    inputSchema: z.object({}),
    execute: async () => {
      const stats = await getStats(orgId);
      return stats;
    },
  });
}
