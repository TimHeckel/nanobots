import { tool } from "ai";
import { z } from "zod";
import { getSwarmByName } from "@/lib/db/queries/swarms";
import { getRepoByFullName } from "@/lib/db/queries/org-repos";
import { getOrgById } from "@/lib/db/queries/organizations";
import { storeScanResult } from "@/lib/db/queries/scan-results";
import { logActivity } from "@/lib/db/queries/activity-log";
import { runAllNanobots } from "@/lib/nanobots/orchestrator";
import { createWebhookHandler } from "@/lib/webhooks/dispatcher";

export function runSwarmToolDef(orgId: string, userId: string) {
  return tool({
    description:
      "Run a swarm (named bot collection) against a repository. Only the bots in the swarm will run.",
    inputSchema: z.object({
      swarmName: z.string().describe("Name of the swarm to run"),
      repoName: z
        .string()
        .describe('Full repository name (e.g. "org/repo")'),
    }),
    execute: async ({ swarmName, repoName }) => {
      const swarm = await getSwarmByName(orgId, swarmName);
      if (!swarm) {
        return { error: `Swarm "${swarmName}" not found.` };
      }

      if (swarm.bot_names.length === 0) {
        return { error: `Swarm "${swarmName}" has no bots. Add bots with manageSwarm first.` };
      }

      const repo = await getRepoByFullName(orgId, repoName);
      if (!repo) {
        return { error: `Repository "${repoName}" is not connected to this organization.` };
      }

      const org = await getOrgById(orgId);
      if (!org) {
        return { error: "Organization not found." };
      }

      const [owner, repoShort] = repoName.split("/");
      const startTime = Date.now();
      const onEvent = createWebhookHandler(orgId, userId);

      try {
        const prUrls = await runAllNanobots(
          org.github_installation_id,
          owner,
          repoShort,
          { enabledBots: swarm.bot_names, onEvent }
        );

        const durationMs = Date.now() - startTime;

        const findings = prUrls.map((url) => ({
          bot: "swarm-scan",
          findingCount: 1,
          prUrl: url,
        }));

        await storeScanResult({
          org_id: orgId,
          repo_full_name: repoName,
          trigger_type: "manual",
          bots_run: swarm.bot_names,
          findings,
          total_findings: findings.length,
          total_prs: prUrls.length,
          duration_ms: durationMs,
        });

        await logActivity(
          orgId,
          "swarm.run",
          `Swarm "${swarmName}" ran on ${repoName}: ${prUrls.length} PRs created`,
          { swarmName, repoName, prUrls, durationMs, bots: swarm.bot_names },
          userId
        );

        return {
          success: true,
          swarm: swarmName,
          repo: repoName,
          botsRun: swarm.bot_names,
          prsCreated: prUrls.length,
          prUrls,
          durationMs,
        };
      } catch (err) {
        return {
          error: `Swarm scan failed: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    },
  });
}
