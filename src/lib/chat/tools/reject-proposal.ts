import { tool } from "ai";
import { z } from "zod";
import {
  getProposalById,
  updateProposalStatus,
} from "@/lib/db/queries/prompt-proposals";
import { logActivity } from "@/lib/db/queries/activity-log";

export function rejectProposalToolDef(
  orgId: string,
  userId: string,
  role: string
) {
  return tool({
    description: "Reject a pending prompt update proposal",
    inputSchema: z.object({
      proposalId: z.string().describe("The ID of the proposal to reject"),
      reason: z
        .string()
        .optional()
        .describe("Reason for rejecting the proposal"),
    }),
    execute: async ({ proposalId, reason }) => {
      if (role !== "admin") {
        return { error: "Only admins can reject proposals." };
      }

      const proposal = await getProposalById(proposalId);
      if (!proposal) {
        return { error: "Proposal not found." };
      }
      if (proposal.status !== "pending") {
        return { error: `Proposal has already been ${proposal.status}.` };
      }

      await updateProposalStatus(proposalId, "rejected", userId);

      await logActivity(
        orgId,
        "proposal.rejected",
        `Rejected prompt proposal for ${proposal.agent_name}${reason ? `: ${reason}` : ""}`,
        { proposalId, agentName: proposal.agent_name, reason },
        userId
      );

      return {
        success: true,
        agentName: proposal.agent_name,
        message: `Proposal for "${proposal.agent_name}" has been rejected.`,
      };
    },
  });
}
