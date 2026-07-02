import { describe, expect, it } from "vitest";
import { runSwarmToolDef } from "@/lib/chat/tools/run-swarm";

describe("run swarm tool contract", () => {
  it("returns the minimal control-room swarm run states", async () => {
    const tool = runSwarmToolDef("org_1", "user_1");
    const missingOrgTool = runSwarmToolDef("org_missing", "user_1");

    expect(tool.description).toContain("Run a control-room swarm");

    await expect(
      tool.execute({
        swarmName: "missing-swarm",
        repoName: "acme/api",
      })
    ).resolves.toEqual({
      error: 'Swarm "missing-swarm" not found.',
    });

    await expect(
      tool.execute({
        swarmName: "empty-swarm",
        repoName: "acme/api",
      })
    ).resolves.toEqual({
      error: 'Swarm "empty-swarm" has no bots.',
    });

    await expect(
      tool.execute({
        swarmName: "access-review-swarm",
        repoName: "missing/repo",
      })
    ).resolves.toEqual({
      error: 'Repository "missing/repo" is not connected to this organization.',
    });

    await expect(
      missingOrgTool.execute({
        swarmName: "access-review-swarm",
        repoName: "acme/api",
      })
    ).resolves.toEqual({
      error: "Organization not found.",
    });

    await expect(
      tool.execute({
        swarmName: "access-review-swarm",
        repoName: "error/repo",
      })
    ).resolves.toEqual({
      error: "Swarm scan failed: simulated swarm failure",
    });

    await expect(
      tool.execute({
        swarmName: "access-review-swarm",
        repoName: "acme/api",
      })
    ).resolves.toEqual({
      success: true,
      orgId: "org_1",
      userId: "user_1",
      swarm: "access-review-swarm",
      repo: "acme/api",
      botsRun: ["evidence-bot", "policy-bot"],
      prsCreated: 1,
      prUrls: ["https://github.com/acme/api/pull/84"],
      durationMs: 1800,
    });
  });
});
