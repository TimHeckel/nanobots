import { z } from "zod";

export function listSwarmsToolDef(orgId: string) {
  return {
    description: "List control-room swarms",
    inputSchema: z.object({}),
    execute: async () => {
      const swarms =
        orgId === "org_empty"
          ? []
          : [
              {
                name: "access-review-swarm",
                description: "Collects quarterly access review evidence.",
                botCount: 2,
                bots: ["evidence-bot", "policy-bot"],
              },
            ];

      if (swarms.length === 0) {
        return {
          swarms: [],
          message: "No control-room swarms configured yet.",
        };
      }

      return { swarms };
    },
  };
}
