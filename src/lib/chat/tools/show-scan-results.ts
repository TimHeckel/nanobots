import { tool } from "ai";
import { z } from "zod";
import { getRecentScans } from "@/lib/db/queries/scan-results";

export function showScanResultsToolDef(orgId: string) {
  return tool({
    description: "Show recent scan results",
    inputSchema: z.object({
      repoName: z
        .string()
        .optional()
        .describe("Filter by repository full name (optional)"),
      limit: z
        .number()
        .optional()
        .default(5)
        .describe("Number of results to return (default 5)"),
    }),
    execute: async ({ repoName, limit }) => {
      const scans = await getRecentScans(orgId, repoName, limit);
      return scans.map((s) => ({
        id: s.id,
        repo: s.repo_full_name,
        triggerType: s.trigger_type,
        botsRun: s.bots_run,
        findings: s.findings,
        totalFindings: s.total_findings,
        totalPrs: s.total_prs,
        durationMs: s.duration_ms,
        createdAt: s.created_at,
      }));
    },
  });
}
