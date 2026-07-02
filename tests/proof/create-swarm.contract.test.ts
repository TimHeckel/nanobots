import { describe, expect, it } from "vitest";
import { createSwarmToolDef } from "@/lib/chat/tools/create-swarm";

describe("create swarm tool contract", () => {
  it("returns the minimal control-room swarm draft result", async () => {
    const tool = createSwarmToolDef("org_1", "user_1");
    const result = await tool.execute({
      name: "evidence-swarm",
      description: "Runs evidence collectors",
      botNames: ["evidence-bot"],
    });
    const fallbackResult = await tool.execute({
      name: "empty-swarm",
      description: "No bots yet",
    });

    expect(tool.description).toContain("control-room swarm draft");
    expect(result).toEqual({
      success: true,
      orgId: "org_1",
      userId: "user_1",
      swarm: {
        name: "evidence-swarm",
        description: "Runs evidence collectors",
        bots: ["evidence-bot"],
      },
      message: 'Swarm "evidence-swarm" created.',
    });
    expect(fallbackResult).toEqual({
      success: true,
      orgId: "org_1",
      userId: "user_1",
      swarm: {
        name: "empty-swarm",
        description: "No bots yet",
        bots: [],
      },
      message: 'Swarm "empty-swarm" created.',
    });
  });
});
