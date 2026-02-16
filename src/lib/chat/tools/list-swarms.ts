import { tool } from "ai";
import { z } from "zod";
import { listSwarms } from "@/lib/db/queries/swarms";

export function listSwarmsToolDef(orgId: string) {
  return tool({
    description: "List all swarms (named bot collections) in the organization",
    inputSchema: z.object({}),
    execute: async () => {
      const swarms = await listSwarms(orgId);

      if (swarms.length === 0) {
        return {
          swarms: [],
          message: "No swarms configured yet. Use createSwarm to create one.",
        };
      }

      return {
        swarms: swarms.map((s) => ({
          name: s.name,
          description: s.description,
          botCount: s.bot_count,
          bots: s.bot_names,
        })),
      };
    },
  });
}
