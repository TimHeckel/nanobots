import { tool } from "ai";
import { z } from "zod";
import { getDocFreshness } from "@/lib/db/queries/doc-generations";
import { getRepoByFullName } from "@/lib/db/queries/org-repos";

export function docStatusToolDef(orgId: string) {
  return tool({
    description: "Check the status and freshness of generated documentation for a repository. Shows when docs were last generated and their PR URLs.",
    inputSchema: z.object({
      repoName: z.string().describe('Full repository name (e.g. "org/repo")'),
    }),
    execute: async ({ repoName }) => {
      const repo = await getRepoByFullName(orgId, repoName);
      if (!repo) {
        return { error: `Repository "${repoName}" is not connected to this organization.` };
      }

      const freshness = await getDocFreshness(orgId, repoName);

      if (freshness.length === 0) {
        return {
          repo: repoName,
          status: "no_docs",
          message: "No documentation has been generated yet for this repository.",
          docs: [],
        };
      }

      const docs = freshness.map((f) => ({
        type: f.doc_type,
        generatedAt: f.generated_at,
        prUrl: f.pr_url,
      }));

      return {
        repo: repoName,
        status: "has_docs",
        docs,
      };
    },
  });
}
