import { z } from "zod";

export function generateDocsToolDef(orgId: string, userId: string) {
  return {
    description: "Generate a control-room documentation draft",
    inputSchema: z.object({
      repoName: z.string(),
      docType: z.enum(["all", "readme", "architecture", "api"]).optional(),
    }),
    execute: async ({
      repoName,
      docType = "all",
    }: {
      repoName: string;
      docType?: "all" | "readme" | "architecture" | "api";
    }) => ({
      success: true,
      orgId,
      userId,
      repo: repoName,
      docType,
      status: "draft",
      message: `Prepared ${docType} documentation for ${repoName}.`,
    }),
  };
}
