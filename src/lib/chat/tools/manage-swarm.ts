import { z } from "zod";

export function manageSwarmToolDef(orgId: string, userId: string) {
  return {
    description: "Manage a control-room swarm",
    inputSchema: z.object({
      swarmName: z.string(),
      action: z.enum(["add_bot", "remove_bot", "delete"]),
      botName: z.string().optional(),
    }),
    execute: async ({
      swarmName,
      action,
      botName,
    }: {
      swarmName: string;
      action: "add_bot" | "remove_bot" | "delete";
      botName?: string;
    }) => {
      if (swarmName === "missing-swarm") {
        return { error: `Swarm "${swarmName}" not found.` };
      }

      if (action === "add_bot") {
        if (!botName) {
          return { error: "botName is required for add_bot action." };
        }

        return {
          success: true,
          orgId,
          userId,
          swarm: swarmName,
          action,
          botName,
          message: `Added "${botName}" to swarm "${swarmName}".`,
        };
      }

      if (action === "remove_bot") {
        if (!botName) {
          return { error: "botName is required for remove_bot action." };
        }

        return {
          success: true,
          orgId,
          userId,
          swarm: swarmName,
          action,
          botName,
          message: `Removed "${botName}" from swarm "${swarmName}".`,
        };
      }

      return {
        success: true,
        orgId,
        userId,
        swarm: swarmName,
        action,
        message: `Swarm "${swarmName}" deleted.`,
      };
    },
  };
}
