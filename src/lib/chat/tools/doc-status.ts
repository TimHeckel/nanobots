import { z } from "zod";

export function docStatusToolDef(orgId: string) {
  return {
    description: "Check control-room documentation status",
    inputSchema: z.object({
      repoName: z.string(),
    }),
    execute: async ({ repoName }: { repoName: string }) => ({
      orgId,
      repo: repoName,
      status: "preview",
      docs: [],
    }),
  };
}
