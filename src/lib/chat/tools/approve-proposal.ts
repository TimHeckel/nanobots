import { z } from "zod";

export function approveProposalToolDef(orgId: string, userId: string) {
  return {
    description: "Approve a pending control-room proposal",
    inputSchema: z.object({
      proposalId: z.string(),
    }),
    execute: async ({ proposalId }: { proposalId: string }) => ({
      success: true,
      orgId,
      userId,
      proposalId,
      message: `Approved proposal ${proposalId}.`,
    }),
  };
}
