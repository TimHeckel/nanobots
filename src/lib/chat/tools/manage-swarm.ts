import { tool } from "ai";
import { z } from "zod";
import {
  getSwarmByName,
  addBotToSwarm,
  removeBotFromSwarm,
  deleteSwarm,
} from "@/lib/db/queries/swarms";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function manageSwarmToolDef(orgId: string, userId: string) {
  return tool({
    description:
      "Manage a swarm: add or remove bots, or delete the swarm entirely",
    inputSchema: z.object({
      swarmName: z.string().describe("Name of the swarm to manage"),
      action: z
        .enum(["add_bot", "remove_bot", "delete"])
        .describe("Action to perform"),
      botName: z
        .string()
        .optional()
        .describe("Bot name (required for add_bot and remove_bot)"),
    }),
    execute: async ({ swarmName, action, botName }) => {
      const swarm = await getSwarmByName(orgId, swarmName);
      if (!swarm) {
        return { error: `Swarm "${swarmName}" not found.` };
      }

      switch (action) {
        case "add_bot": {
          if (!botName) {
            return { error: "botName is required for add_bot action." };
          }
          await addBotToSwarm(swarm.id, botName);
          return {
            success: true,
            message: `Added "${botName}" to swarm "${swarmName}".`,
            swarm: swarmName,
            action: "add_bot",
            botName,
          };
        }
        case "remove_bot": {
          if (!botName) {
            return { error: "botName is required for remove_bot action." };
          }
          await removeBotFromSwarm(swarm.id, botName);
          return {
            success: true,
            message: `Removed "${botName}" from swarm "${swarmName}".`,
            swarm: swarmName,
            action: "remove_bot",
            botName,
          };
        }
        case "delete": {
          await deleteSwarm(swarm.id, orgId);
          return {
            success: true,
            message: `Swarm "${swarmName}" deleted.`,
            swarm: swarmName,
            action: "delete",
          };
        }
      }
    },
  });
}
