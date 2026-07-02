import { describe, expect, it } from "vitest";
import { listProposalsToolDef } from "@/lib/chat/tools/list-proposals";

describe("list proposals tool contract", () => {
  it("returns the minimal control-room proposal queue", async () => {
    const tool = listProposalsToolDef("org_1");

    expect(tool.description).toContain("control-room proposals");

    await expect(tool.execute({})).resolves.toEqual([
      {
        id: "prop_1",
        orgId: "org_1",
        agentName: "evidence-bot",
        reason: "Missing quarterly access review evidence",
        severity: "high",
        status: "pending",
      },
      {
        id: "prop_2",
        orgId: "org_1",
        agentName: "policy-bot",
        reason: "Policy update needed for change management",
        severity: "medium",
        status: "pending",
      },
    ]);
  });
});
