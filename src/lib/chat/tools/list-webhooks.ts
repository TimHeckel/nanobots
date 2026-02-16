import { tool } from "ai";
import { z } from "zod";
import { getWebhookEndpoints } from "@/lib/db/queries/webhooks";

export function listWebhooksToolDef(orgId: string) {
  return tool({
    description: "List all webhook endpoints configured for this organization",
    inputSchema: z.object({}),
    execute: async () => {
      const endpoints = await getWebhookEndpoints(orgId);

      if (endpoints.length === 0) {
        return {
          webhooks: [],
          message: "No webhooks configured. Use configureWebhook to set one up.",
        };
      }

      return {
        webhooks: endpoints.map((ep) => ({
          id: ep.id,
          url: ep.url,
          events: ep.events,
          active: ep.active,
          description: ep.description,
          createdAt: ep.created_at,
        })),
      };
    },
  });
}
