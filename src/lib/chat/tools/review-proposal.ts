import { tool } from "ai";
import { z } from "zod";
import { getProposalById } from "@/lib/db/queries/prompt-proposals";

export function reviewProposalToolDef() {
  return tool({
    description:
      "Show full details of a prompt proposal including the diff",
    inputSchema: z.object({
      proposalId: z.string().describe("The ID of the proposal to review"),
    }),
    execute: async ({ proposalId }) => {
      const proposal = await getProposalById(proposalId);
      if (!proposal) {
        return { error: "Proposal not found." };
      }

      return {
        id: proposal.id,
        agentName: proposal.agent_name,
        status: proposal.status,
        currentPrompt: proposal.current_prompt,
        proposedPrompt: proposal.proposed_prompt,
        diffSummary: proposal.diff_summary,
        reason: proposal.reason,
        severity: proposal.severity,
        threatSource: proposal.threat_source,
        advisoryId: proposal.advisory_id,
        createdAt: proposal.created_at,
      };
    },
  });
}
