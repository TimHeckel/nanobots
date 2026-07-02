import { z } from "zod";

export function listProposalsToolDef(orgId: string) {
  return {
    description: "List pending control-room proposals",
    inputSchema: z.object({}),
    execute: async () => [
      {
        id: "prop_1",
        orgId,
        agentName: "evidence-bot",
        reason: "Missing quarterly access review evidence",
        severity: "high",
        status: "pending",
      },
      {
        id: "prop_2",
        orgId,
        agentName: "policy-bot",
        reason: "Policy update needed for change management",
        severity: "medium",
        status: "pending",
      },
    ],
  };
}
