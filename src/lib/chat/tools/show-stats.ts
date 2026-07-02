import { z } from "zod";

export function showStatsToolDef(orgId: string) {
  return {
    description: "Show aggregate control-room scan statistics",
    inputSchema: z.object({}),
    execute: async () => ({
      orgId,
      connectedSources: 3,
      mappedControls: 12,
      staleControls: 2,
      openExceptions: 1,
      lastSprintoSyncAt: "2026-03-26T12:00:00.000Z",
    }),
  };
}
