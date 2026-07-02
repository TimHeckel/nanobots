import { describe, expect, it } from "vitest";
import { reviewProposalToolDef } from "@/lib/chat/tools/review-proposal";

describe("review proposal tool contract", () => {
  it("returns the minimal control-room proposal review states", async () => {
    const tool = reviewProposalToolDef();

    expect(tool.description).toContain("control-room proposal");

    await expect(
      tool.execute({
        proposalId: "missing-proposal",
      })
    ).resolves.toEqual({
      error: "Proposal not found.",
    });

    await expect(
      tool.execute({
        proposalId: "prop_1",
      })
    ).resolves.toEqual({
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
    });
  });
});
