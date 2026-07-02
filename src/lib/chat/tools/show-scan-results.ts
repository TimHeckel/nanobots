import { z } from "zod";

const SCAN_RESULTS = [
  {
    id: "scan_1",
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
    repo: "acme/web",
    triggerType: "manual",
    botsRun: ["monitoring-bot"],
    findings: [{ type: "missing-evidence", count: 2 }],
    totalFindings: 2,
    totalPrs: 0,
    durationMs: 900,
    createdAt: "2026-03-26T11:15:00.000Z",
  },
] as const;

export function showScanResultsToolDef(orgId: string) {
  return {
    description: "Show recent control-room scan results",
    inputSchema: z.object({
      repoName: z.string().optional(),
      limit: z.number().optional().default(5),
    }),
    execute: async ({
      repoName,
      limit = 5,
    }: {
      repoName?: string;
      limit?: number;
    }) =>
      SCAN_RESULTS.filter((scan) => !repoName || scan.repo === repoName)
        .slice(0, limit)
        .map((scan) => ({
          orgId,
          ...scan,
        })),
  };
}
