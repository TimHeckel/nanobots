import { describe, expect, it } from "vitest";
import { rejectProposalToolDef } from "@/lib/chat/tools/reject-proposal";

describe("reject proposal tool contract", () => {
  it("returns the minimal control-room rejection states", async () => {
    const adminTool = rejectProposalToolDef("org_1", "user_1", "admin");
    const memberTool = rejectProposalToolDef("org_1", "user_2", "member");

    expect(adminTool.description).toContain("Reject a pending control-room proposal");

    await expect(
      memberTool.execute({
        proposalId: "prop_1",
      })
    ).resolves.toEqual({
      error: "Only admins can reject control-room proposals.",
    });

    await expect(
      adminTool.execute({
        proposalId: "missing-proposal",
      })
    ).resolves.toEqual({
      error: "Proposal not found.",
    });

    await expect(
      adminTool.execute({
        proposalId: "approved-proposal",
      })
    ).resolves.toEqual({
      error: "Proposal has already been approved.",
    });

    await expect(
      adminTool.execute({
        proposalId: "prop_1",
        reason: "Insufficient evidence quality",
      })
    ).resolves.toEqual({
      success: true,
      orgId: "org_1",
      userId: "user_1",
      proposalId: "prop_1",
      agentName: "evidence-bot",
      message: 'Proposal for "evidence-bot" has been rejected.',
    });
  });
});
