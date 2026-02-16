import crypto from "crypto";
import { logActivity } from "@/lib/db/queries/activity-log";
import {
  getEndpointsByOrgAndEvent,
  logDelivery,
} from "@/lib/db/queries/webhooks";
import type {
  BotEvent,
  BotEventCallback,
} from "@/lib/nanobots/ai-bots/events";
import type { WebhookEndpoint } from "@/lib/db/schema";

export function signPayload(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export async function deliverToEndpoint(
  endpoint: WebhookEndpoint,
  event: BotEvent
): Promise<void> {
  const body = JSON.stringify(event);
  const signature = signPayload(body, endpoint.secret);
  const deliveryId = crypto.randomUUID();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Nanobots-Signature-256": `sha256=${signature}`,
        "X-Nanobots-Event": event.type,
        "X-Nanobots-Delivery": deliveryId,
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    await logDelivery({
      webhookId: endpoint.id,
      eventType: event.type,
      payload: event as unknown as Record<string, unknown>,
      statusCode: response.status,
      error: response.ok ? null : `HTTP ${response.status}`,
    });
  } catch (err) {
    await logDelivery({
      webhookId: endpoint.id,
      eventType: event.type,
      payload: event as unknown as Record<string, unknown>,
      statusCode: null,
      error: String(err),
    });
  }
}

export function createWebhookHandler(
  orgId: string,
  actorId?: string
): BotEventCallback {
  return (event: BotEvent) => {
    // Fire-and-forget — never throws
    (async () => {
      try {
        // 1. Log to activity_log
        await logActivity(
          orgId,
          event.type,
          buildSummary(event),
          event as unknown as Record<string, unknown>,
          actorId
        );

        // 2. Dispatch to matching webhooks
        const endpoints = await getEndpointsByOrgAndEvent(orgId, event.type);
        if (endpoints.length > 0) {
          await Promise.allSettled(
            endpoints.map((ep) => deliverToEndpoint(ep, event))
          );
        }
      } catch (err) {
        console.error(
          `[webhook-dispatcher] Error processing ${event.type}:`,
          err
        );
      }
    })();
  };
}

function buildSummary(event: BotEvent): string {
  switch (event.type) {
    case "scan.started":
      return `Scan started: ${event.botCount} bots, ${event.fileCount} files on ${event.repo}`;
    case "scan.completed":
      return `Scan completed: ${event.totalFindings} findings in ${event.durationMs}ms`;
    case "bot.started":
      return `${event.botName} started: ${event.fileCount} files, ${event.batchCount} batches`;
    case "bot.completed":
      return `${event.botName} completed: ${event.findingCount} findings in ${event.durationMs}ms`;
    case "bot.error":
      return `${event.botName} error at batch ${event.batchIndex}: ${event.error}`;
    case "bot.finding":
      return `${event.botName} finding: ${event.finding.severity} in ${event.finding.file}`;
    case "pr.created":
      return `${event.botName} created PR: ${event.prUrl}`;
  }
}
