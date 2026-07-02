import { describe, expect, it } from "vitest";
import { manageSwarmToolDef } from "@/lib/chat/tools/manage-swarm";

describe("manage swarm tool contract", () => {
  it("returns the minimal control-room swarm management states", async () => {
    const tool = manageSwarmToolDef("org_1", "user_1");

    expect(tool.description).toContain("Manage a control-room swarm");

    await expect(
      tool.execute({
        swarmName: "missing-swarm",
        action: "delete",
      })
    ).resolves.toEqual({
      error: 'Swarm "missing-swarm" not found.',
    });

    await expect(
      tool.execute({
        swarmName: "access-review-swarm",
        action: "add_bot",
      })
    ).resolves.toEqual({
      error: "botName is required for add_bot action.",
    });

    await expect(
      tool.execute({
        swarmName: "access-review-swarm",
        action: "add_bot",
        botName: "monitoring-bot",
      })
    ).resolves.toEqual({
      success: true,
      orgId: "org_1",
      userId: "user_1",
      swarm: "access-review-swarm",
      action: "add_bot",
      botName: "monitoring-bot",
      message: 'Added "monitoring-bot" to swarm "access-review-swarm".',
    });

    await expect(
      tool.execute({
        swarmName: "access-review-swarm",
        action: "remove_bot",
      })
    ).resolves.toEqual({
      error: "botName is required for remove_bot action.",
    });

    await expect(
      tool.execute({
        swarmName: "access-review-swarm",
        action: "remove_bot",
        botName: "policy-bot",
      })
    ).resolves.toEqual({
      success: true,
      orgId: "org_1",
      userId: "user_1",
      swarm: "access-review-swarm",
      action: "remove_bot",
      botName: "policy-bot",
      message: 'Removed "policy-bot" from swarm "access-review-swarm".',
    });

    await expect(
      tool.execute({
        swarmName: "access-review-swarm",
        action: "delete",
      })
    ).resolves.toEqual({
      success: true,
      orgId: "org_1",
      userId: "user_1",
      swarm: "access-review-swarm",
      action: "delete",
      message: 'Swarm "access-review-swarm" deleted.',
    });
  });
});
