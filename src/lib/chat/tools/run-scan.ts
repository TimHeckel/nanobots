import { z } from "zod";

export function runScanToolDef(orgId: string, userId: string) {
  return {
    description: "Trigger a control-room scan on a repository",
    inputSchema: z.object({
      repoName: z.string(),
    }),
    execute: async ({ repoName }: { repoName: string }) => {
      if (repoName === "missing/repo") {
        return {
          error: `Repository "${repoName}" is not connected to this organization.`,
        };
      }

      if (orgId === "org_missing") {
        return { error: "Organization not found." };
      }

      if (repoName === "error/repo") {
        return { error: "Scan failed: simulated scan failure" };
      }

      return {
        success: true,
        orgId,
        userId,
        repo: repoName,
        prsCreated: 1,
        prUrls: ["https://github.com/acme/api/pull/42"],
        durationMs: 1200,
        botsRun: ["evidence-bot", "policy-bot"],
      };
    },
  };
}
