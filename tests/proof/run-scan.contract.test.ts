import { describe, expect, it } from "vitest";
import { runScanToolDef } from "@/lib/chat/tools/run-scan";

describe("run scan tool contract", () => {
  it("returns the minimal control-room scan states", async () => {
    const tool = runScanToolDef("org_1", "user_1");
    const missingOrgTool = runScanToolDef("org_missing", "user_1");

    expect(tool.description).toContain("Trigger a control-room scan");

    await expect(
      tool.execute({
        repoName: "missing/repo",
      })
    ).resolves.toEqual({
      error: 'Repository "missing/repo" is not connected to this organization.',
    });

    await expect(
      missingOrgTool.execute({
        repoName: "acme/api",
      })
    ).resolves.toEqual({
      error: "Organization not found.",
    });

    await expect(
      tool.execute({
        repoName: "error/repo",
      })
    ).resolves.toEqual({
      error: "Scan failed: simulated scan failure",
    });

    await expect(
      tool.execute({
        repoName: "acme/api",
      })
    ).resolves.toEqual({
      success: true,
      orgId: "org_1",
      userId: "user_1",
      repo: "acme/api",
      prsCreated: 1,
      prUrls: ["https://github.com/acme/api/pull/42"],
      durationMs: 1200,
      botsRun: ["evidence-bot", "policy-bot"],
    });
  });
});
