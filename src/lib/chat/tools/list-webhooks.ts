import { z } from "zod";

export function listWebhooksToolDef(orgId: string) {
  return {
    description: "List control-room webhook endpoints",
    inputSchema: z.object({}),
    execute: async () => {
      const webhooks =
        orgId === "org_empty"
          ? []
          : [
              {
                id: "wh_1",
                url: "https://example.com/control-room/webhooks/github",
                events: ["evidence.updated", "control.exception"],
                active: true,
                description: "Primary Sprinto middleware webhook",
              },
            ];

      if (webhooks.length === 0) {
        return {
          webhooks: [],
          message: "No control-room webhooks configured yet.",
        };
      }

      return { webhooks };
    },
  };
}
