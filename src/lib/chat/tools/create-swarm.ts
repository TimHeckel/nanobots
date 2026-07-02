import { z } from "zod";

export function createSwarmToolDef(orgId: string, userId: string) {
  return {
    description: "Create a control-room swarm draft",
    inputSchema: z.object({
      name: z.string(),
      description: z.string(),
      botNames: z.array(z.string()).optional(),
    }),
    execute: async ({
      name,
      description,
      botNames,
    }: {
      name: string;
      description: string;
      botNames?: string[];
    }) => ({
      success: true,
      orgId,
      userId,
      swarm: {
        name,
        description,
        bots: botNames ?? [],
      },
      message: `Swarm "${name}" created.`,
    }),
  };
}
