import { describe, expect, it } from "vitest";
import { promoteBotToolDef } from "@/lib/chat/tools/promote-bot";

describe("promote bot tool contract", () => {
  it("returns the minimal control-room promotion states", async () => {
    const tool = promoteBotToolDef("org_1", "user_1");

    expect(tool.description).toContain("Promote a control-room bot");

    await expect(
      tool.execute({
        botName: "missing-bot",
      })
    ).resolves.toEqual({
      error: 'Bot "missing-bot" not found.',
    });

    await expect(
      tool.execute({
        botName: "evidence-bot",
      })
    ).resolves.toEqual({
      success: true,
      orgId: "org_1",
      userId: "user_1",
      bot: "evidence-bot",
      fromStatus: "draft",
      toStatus: "testing",
      message: 'Bot "evidence-bot" promoted from draft to testing.',
    });

    await expect(
      tool.execute({
        botName: "policy-bot",
      })
    ).resolves.toEqual({
      success: true,
      orgId: "org_1",
      userId: "user_1",
      bot: "policy-bot",
      fromStatus: "testing",
      toStatus: "active",
      message: 'Bot "policy-bot" promoted from testing to active.',
    });

    await expect(
      tool.execute({
        botName: "monitoring-bot",
      })
    ).resolves.toEqual({
      error: 'Bot "monitoring-bot" is already active.',
    });
  });
});
