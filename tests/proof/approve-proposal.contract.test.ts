import { describe, expect, it } from "vitest";
import { approveProposalToolDef } from "@/lib/chat/tools/approve-proposal";

describe("approve proposal tool contract", () => {
  it("returns the minimal control-room approval result", async () => {
    const tool = approveProposalToolDef("org_1", "user_1");
    const result = await tool.execute({ proposalId: "prop_1" });

    expect(tool.description).toContain("control-room proposal");
    expect(result).toEqual({
      success: true,
      orgId: "org_1",
      userId: "user_1",
      proposalId: "prop_1",
      message: "Approved proposal prop_1.",
    });
  });
});
