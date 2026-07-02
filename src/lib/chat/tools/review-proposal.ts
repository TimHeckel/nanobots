import { z } from "zod";

const PROPOSALS = {
  "prop_1": {
    id: "prop_1",
    agentName: "evidence-bot",
    status: "pending",
    currentPrompt: "Collect evidence weekly.",
    proposedPrompt: "Collect evidence daily and flag stale controls.",
    diffSummary: "Adds stale-control monitoring guidance.",
    reason: "Control freshness signal was missing.",
    severity: "high",
    threatSource: "control-gap-review",
    advisoryId: "SOC2-CC8.1",
    createdAt: "2026-03-26T10:00:00.000Z",
  },
} as const;

export function reviewProposalToolDef() {
  return {
    description: "Show full details of a control-room proposal",
    inputSchema: z.object({
      proposalId: z.string(),
    }),
    execute: async ({ proposalId }: { proposalId: string }) => {
      const proposal = PROPOSALS[proposalId as keyof typeof PROPOSALS];

      if (!proposal) {
        return { error: "Proposal not found." };
      }

      return proposal;
    },
  };
}
