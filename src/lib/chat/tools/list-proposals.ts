import { tool } from "ai";
import { z } from "zod";
import { getPendingProposals } from "@/lib/db/queries/prompt-proposals";

export function listProposalsToolDef(orgId: string) {
  return tool({
    description:
      "List pending prompt update proposals from the threat pipeline",
    inputSchema: z.object({}),
    execute: async () => {
      const proposals = await getPendingProposals(orgId);
      return proposals.map((p) => ({
        id: p.id,
        agentName: p.agent_name,
        reason: p.reason,
        severity: p.severity,
        threatSource: p.threat_source,
        advisoryId: p.advisory_id,
        createdAt: p.created_at,
      }));
    },
  });
}
