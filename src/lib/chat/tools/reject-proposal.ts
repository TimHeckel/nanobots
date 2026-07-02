import { z } from "zod";

const PROPOSAL_STATES = {
  "prop_1": {
    agentName: "evidence-bot",
    status: "pending",
  },
  "approved-proposal": {
    agentName: "policy-bot",
    status: "approved",
  },
} as const;

export function rejectProposalToolDef(
  orgId: string,
  userId: string,
  role: string
) {
  return {
    description: "Reject a pending control-room proposal",
    inputSchema: z.object({
      proposalId: z.string(),
      reason: z.string().optional(),
    }),
    execute: async ({
      proposalId,
    }: {
      proposalId: string;
      reason?: string;
    }) => {
      if (role !== "admin") {
        return { error: "Only admins can reject control-room proposals." };
      }

      const proposal =
        PROPOSAL_STATES[proposalId as keyof typeof PROPOSAL_STATES];

      if (!proposal) {
        return { error: "Proposal not found." };
      }

      if (proposal.status !== "pending") {
        return { error: `Proposal has already been ${proposal.status}.` };
      }

      return {
        success: true,
        orgId,
        userId,
        proposalId,
        agentName: proposal.agentName,
        message: `Proposal for "${proposal.agentName}" has been rejected.`,
      };
    },
  };
}
