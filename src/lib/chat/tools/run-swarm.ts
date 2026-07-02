import { z } from "zod";

export function runSwarmToolDef(orgId: string, userId: string) {
  return {
    description: "Run a control-room swarm against a repository",
    inputSchema: z.object({
      swarmName: z.string(),
      repoName: z.string(),
    }),
    execute: async ({
      swarmName,
      repoName,
    }: {
      swarmName: string;
      repoName: string;
    }) => {
      if (swarmName === "missing-swarm") {
        return { error: `Swarm "${swarmName}" not found.` };
      }

      if (swarmName === "empty-swarm") {
        return { error: `Swarm "${swarmName}" has no bots.` };
      }

      if (repoName === "missing/repo") {
        return {
          error: `Repository "${repoName}" is not connected to this organization.`,
        };
      }

      if (orgId === "org_missing") {
        return { error: "Organization not found." };
      }

      if (repoName === "error/repo") {
        return { error: "Swarm scan failed: simulated swarm failure" };
      }

      return {
        success: true,
        orgId,
        userId,
        swarm: swarmName,
        repo: repoName,
        botsRun: ["evidence-bot", "policy-bot"],
        prsCreated: 1,
        prUrls: ["https://github.com/acme/api/pull/84"],
        durationMs: 1800,
      };
    },
  };
}
