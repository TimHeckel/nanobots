import { tool } from "ai";
import { z } from "zod";
import {
  getProposalById,
  updateProposalStatus,
} from "@/lib/db/queries/prompt-proposals";
import {
  upsertSystemPrompt,
  createVersion,
  getVersionCount,
  getSystemPrompt,
} from "@/lib/db/queries/system-prompts";
import { logActivity } from "@/lib/db/queries/activity-log";

export function approveProposalToolDef(
  orgId: string,
  userId: string,
  role: string
) {
  return tool({
    description: "Approve a pending prompt update proposal",
    inputSchema: z.object({
      proposalId: z.string().describe("The ID of the proposal to approve"),
    }),
    execute: async ({ proposalId }) => {
      if (role !== "admin") {
        return { error: "Only admins can approve proposals." };
      }

      const proposal = await getProposalById(proposalId);
      if (!proposal) {
        return { error: "Proposal not found." };
      }
      if (proposal.status !== "pending") {
        return { error: `Proposal has already been ${proposal.status}.` };
      }

      // Approve the proposal
      await updateProposalStatus(proposalId, "approved", userId);

      // Update the system prompt with the proposed text
      const updatedPrompt = await upsertSystemPrompt(
        orgId,
        proposal.agent_name,
        proposal.proposed_prompt,
        userId
      );

      // Create a version record
      const existingPrompt = await getSystemPrompt(orgId, proposal.agent_name);
      const versionCount = existingPrompt
        ? await getVersionCount(existingPrompt.id)
        : 0;

      await createVersion(
        updatedPrompt.id,
        versionCount + 1,
        proposal.proposed_prompt,
        proposal.reason ?? "Approved threat pipeline proposal",
        userId
      );

      await logActivity(
        orgId,
        "proposal.approved",
        `Approved prompt proposal for ${proposal.agent_name}`,
        { proposalId, agentName: proposal.agent_name },
        userId
      );

      return {
        success: true,
        agentName: proposal.agent_name,
        message: `Proposal approved. System prompt for "${proposal.agent_name}" has been updated.`,
      };
    },
  });
}
