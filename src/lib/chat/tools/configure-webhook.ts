import { z } from "zod";

export function configureWebhookToolDef(orgId: string, userId: string) {
  return {
    description: "Configure a control-room webhook endpoint",
    inputSchema: z.object({
      url: z.string(),
      events: z.array(z.string()),
      description: z.string().optional(),
    }),
    execute: async ({
      url,
      events,
      description,
    }: {
      url: string;
      events: string[];
      description?: string;
    }) => ({
      success: true,
      orgId,
      userId,
      webhook: {
        url,
        events,
        description: description ?? null,
      },
      message: `Webhook configured for ${events.length} event type(s).`,
    }),
  };
}
