import { tool } from "ai";
import { z } from "zod";
import { createSwarm, addBotToSwarm } from "@/lib/db/queries/swarms";

export function createSwarmToolDef(orgId: string, userId: string) {
  return tool({
    description:
      "Create a swarm — a named collection of bots that run together as a group",
    inputSchema: z.object({
      name: z
        .string()
        .describe("Kebab-case swarm name (e.g. 'security-suite')"),
      description: z.string().describe("What this swarm does"),
      botNames: z
        .array(z.string())
        .optional()
        .describe("Initial bot names to include in the swarm"),
    }),
    execute: async ({ name, description, botNames }) => {
      try {
        const swarm = await createSwarm(orgId, name, description, userId);

        if (botNames && botNames.length > 0) {
          for (const botName of botNames) {
            await addBotToSwarm(swarm.id, botName);
          }
        }

        return {
          success: true,
          swarm: {
            id: swarm.id,
            name: swarm.name,
            description: swarm.description,
            bots: botNames ?? [],
          },
          message: `Swarm "${name}" created${botNames?.length ? ` with ${botNames.length} bot(s): ${botNames.join(", ")}` : ""}. Use manageSwarm to add or remove bots.`,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("unique") || msg.includes("duplicate")) {
          return { error: `A swarm named "${name}" already exists in this organization.` };
        }
        return { error: `Failed to create swarm: ${msg}` };
      }
    },
  });
}
