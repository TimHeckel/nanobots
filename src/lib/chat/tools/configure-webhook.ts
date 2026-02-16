import { tool } from "ai";
import { z } from "zod";
import { createWebhookEndpoint } from "@/lib/db/queries/webhooks";

export function configureWebhookToolDef(orgId: string, userId: string) {
  return tool({
    description:
      "Set up a webhook endpoint so an external dashboard receives real-time bot events",
    inputSchema: z.object({
      url: z.string().url().describe("The HTTPS endpoint URL to receive events"),
      events: z
        .array(
          z.enum([
            "scan.started",
            "scan.completed",
            "bot.started",
            "bot.completed",
            "bot.finding",
            "pr.created",
          ])
        )
        .describe("Event types to subscribe to"),
      description: z
        .string()
        .optional()
        .describe("Optional description of this webhook (e.g. 'Slack notifications')"),
    }),
    execute: async ({ url, events, description }) => {
      try {
        const endpoint = await createWebhookEndpoint(orgId, url, events, description);

        return {
          success: true,
          webhook: {
            id: endpoint.id,
            url: endpoint.url,
            events: endpoint.events,
            description: endpoint.description,
          },
          secret: endpoint.secret,
          message: `Webhook created for ${events.length} event type(s). The signing secret is shown once — save it now. Events are signed with HMAC-SHA256 in the X-Nanobots-Signature-256 header.`,
        };
      } catch (err) {
        return {
          error: `Failed to create webhook: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    },
  });
}
