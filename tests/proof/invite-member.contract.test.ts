import { describe, expect, it } from "vitest";
import { inviteMemberToolDef } from "@/lib/chat/tools/invite-member";

describe("invite member tool contract", () => {
  it("returns the minimal control-room invitation states", async () => {
    const adminTool = inviteMemberToolDef("org_1", "user_1", "admin");
    const memberTool = inviteMemberToolDef("org_1", "user_2", "member");

    expect(adminTool.description).toContain("control-room team member");

    await expect(
      memberTool.execute({
        githubLogin: "octocat",
        role: "member",
      })
    ).resolves.toEqual({
      success: false,
      orgId: "org_1",
      userId: "user_2",
      error: "Only admins can invite control-room team members.",
    });

    await expect(
      adminTool.execute({
        githubLogin: "octocat",
        role: "admin",
      })
    ).resolves.toEqual({
      success: true,
      orgId: "org_1",
      userId: "user_1",
      invitation: {
        githubLogin: "octocat",
        role: "admin",
        status: "pending",
      },
      message: "Invitation sent to octocat as admin.",
    });
  });
});
