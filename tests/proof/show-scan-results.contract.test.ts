import { describe, expect, it } from "vitest";
import { showScanResultsToolDef } from "@/lib/chat/tools/show-scan-results";

describe("show scan results tool contract", () => {
  it("returns the minimal control-room scan result states", async () => {
    const tool = showScanResultsToolDef("org_1");

    expect(tool.description).toContain("scan results");

    await expect(
      tool.execute({
        repoName: "acme/api",
        limit: 1,
      })
    ).resolves.toEqual([
      {
        id: "scan_1",
        orgId: "org_1",
        repo: "acme/api",
        triggerType: "manual",
        botsRun: ["evidence-bot", "policy-bot"],
        findings: [{ type: "stale-control", count: 1 }],
        totalFindings: 1,
        totalPrs: 1,
        durationMs: 1200,
        createdAt: "2026-03-26T10:30:00.000Z",
      },
    ]);

    await expect(tool.execute({})).resolves.toEqual([
      {
        id: "scan_1",
        orgId: "org_1",
        repo: "acme/api",
        triggerType: "manual",
        botsRun: ["evidence-bot", "policy-bot"],
        findings: [{ type: "stale-control", count: 1 }],
        totalFindings: 1,
        totalPrs: 1,
        durationMs: 1200,
        createdAt: "2026-03-26T10:30:00.000Z",
      },
      {
        id: "scan_2",
        orgId: "org_1",
        repo: "acme/web",
        triggerType: "manual",
        botsRun: ["monitoring-bot"],
        findings: [{ type: "missing-evidence", count: 2 }],
        totalFindings: 2,
        totalPrs: 0,
        durationMs: 900,
        createdAt: "2026-03-26T11:15:00.000Z",
      },
    ]);
  });
});
