import { tool } from "ai";
import { z } from "zod";
import { getRepoByFullName } from "@/lib/db/queries/org-repos";
import { getOrgById } from "@/lib/db/queries/organizations";
import { getEnabledBots } from "@/lib/db/queries/bot-configs";
import { storeScanResult } from "@/lib/db/queries/scan-results";
import { logActivity } from "@/lib/db/queries/activity-log";
import { runAllNanobots } from "@/lib/nanobots/orchestrator";

export function runScanToolDef(orgId: string, userId: string) {
  return tool({
    description: "Trigger a scan on a repository",
    inputSchema: z.object({
      repoName: z
        .string()
        .describe('Full repository name (e.g. "org/repo")'),
    }),
    execute: async ({ repoName }) => {
      // Validate repo belongs to org
      const repo = await getRepoByFullName(orgId, repoName);
      if (!repo) {
        return {
          error: `Repository "${repoName}" is not connected to this organization.`,
        };
      }

      // Get the org for installationId
      const org = await getOrgById(orgId);
      if (!org) {
        return { error: "Organization not found." };
      }

      const [owner, repoShort] = repoName.split("/");
      const enabledBots = await getEnabledBots(orgId);

      const startTime = Date.now();

      try {
        const prUrls = await runAllNanobots(
          org.github_installation_id,
          owner,
          repoShort
        );

        const durationMs = Date.now() - startTime;

        // Build findings from PR URLs (each URL corresponds to a bot that found issues)
        const findings = prUrls.map((url) => ({
          bot: "scan",
          findingCount: 1,
          prUrl: url,
        }));

        // Store scan result
        await storeScanResult({
          org_id: orgId,
          repo_full_name: repoName,
          trigger_type: "manual",
          bots_run: enabledBots,
          findings,
          total_findings: findings.length,
          total_prs: prUrls.length,
          duration_ms: durationMs,
        });

        await logActivity(
          orgId,
          "scan.completed",
          `Manual scan on ${repoName}: ${prUrls.length} PRs created in ${durationMs}ms`,
          { repoName, prUrls, durationMs },
          userId
        );

        return {
          success: true,
          repo: repoName,
          prsCreated: prUrls.length,
          prUrls,
          durationMs,
          botsRun: enabledBots,
        };
      } catch (err) {
        return {
          error: `Scan failed: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    },
  });
}
