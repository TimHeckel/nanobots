import { z } from "zod";

export function listBotsToolDef(orgId: string) {
  return {
    description: "List control-room bot drafts",
    inputSchema: z.object({}),
    execute: async () => [
      {
        orgId,
        name: "evidence-bot",
        enabled: true,
        description: "Collects evidence gaps for Sprinto controls.",
      },
      {
        orgId,
        name: "policy-bot",
        enabled: false,
        description: "Tracks policy changes for control updates.",
      },
    ],
  };
}
