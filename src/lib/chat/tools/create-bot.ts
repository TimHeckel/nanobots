import { z } from "zod";

export function createBotToolDef(orgId: string, userId: string) {
  return {
    description: "Create a control-room bot draft",
    inputSchema: z.object({
      name: z.string(),
      description: z.string(),
      category: z.string(),
      systemPrompt: z.string(),
      fileExtensions: z.array(z.string()).optional(),
    }),
    execute: async ({
      name,
      description,
      category,
    }: {
      name: string;
      description: string;
      category: string;
      systemPrompt: string;
      fileExtensions?: string[];
    }) => ({
      success: true,
      orgId,
      userId,
      bot: {
        name,
        description,
        category,
        status: "draft",
      },
      message: `Bot "${name}" created as draft.`,
    }),
  };
}
