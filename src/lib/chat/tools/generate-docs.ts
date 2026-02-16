import { tool } from "ai";
import { z } from "zod";
import { getRepoByFullName } from "@/lib/db/queries/org-repos";
import { getOrgById } from "@/lib/db/queries/organizations";
import { storeDocGeneration } from "@/lib/db/queries/doc-generations";
import { logActivity } from "@/lib/db/queries/activity-log";
import { runAllNanobots } from "@/lib/nanobots/orchestrator";

export function generateDocsToolDef(orgId: string, userId: string) {
  return tool({
    description: "Generate documentation for a repository (README, architecture diagrams, API docs). Creates a PR with the generated documentation.",
    inputSchema: z.object({
      repoName: z.string().describe('Full repository name (e.g. "org/repo")'),
      docType: z.enum(["all", "readme", "architecture", "api"]).optional()
        .describe("Type of docs to generate. Defaults to all."),
    }),
    execute: async ({ repoName, docType = "all" }) => {
      const repo = await getRepoByFullName(orgId, repoName);
      if (!repo) {
        return { error: `Repository "${repoName}" is not connected to this organization.` };
      }

      const org = await getOrgById(orgId);
      if (!org) {
        return { error: "Organization not found." };
      }

      const [owner, repoShort] = repoName.split("/");

      // Determine which doc bots to run
      const docBotMap: Record<string, string> = {
        readme: "readme-generator",
        architecture: "architecture-mapper",
        api: "api-doc-generator",
      };
      const enabledDocBots = docType === "all"
        ? Object.values(docBotMap)
        : [docBotMap[docType]];

      try {
        const result = await runAllNanobots(
          org.github_installation_id,
          owner,
          repoShort,
          {
            category: "docs",
            enabledBots: enabledDocBots,
            orgLogin: org.github_org_login,
            structured: true,
          }
        );

        // Store doc generation records
        for (const finding of result.findings) {
          if (finding.prUrl) {
            const docTypeMap: Record<string, "readme" | "architecture" | "api"> = {
              "readme-generator": "readme",
              "architecture-mapper": "architecture",
              "api-doc-generator": "api",
            };
            await storeDocGeneration({
              org_id: orgId,
              repo_full_name: repoName,
              doc_type: docTypeMap[finding.bot] ?? "readme",
              pr_url: finding.prUrl,
            });
          }
        }

        await logActivity(
          orgId,
          "docs.generated",
          `Documentation generated for ${repoName}: ${result.totalPrs} PRs created`,
          { repoName, prUrls: result.prUrls, docType, durationMs: result.durationMs },
          userId
        );

        return {
          success: true,
          repo: repoName,
          docType,
          prsCreated: result.totalPrs,
          prUrls: result.prUrls,
          botsRun: result.botsRun,
          durationMs: result.durationMs,
        };
      } catch (err) {
        return {
          error: `Documentation generation failed: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    },
  });
}
