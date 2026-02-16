import crypto from "crypto";
import { sql } from "../index";
import type { WebhookEndpoint, WebhookDelivery } from "../schema";

export async function createWebhookEndpoint(
  orgId: string,
  url: string,
  events: string[],
  description?: string
): Promise<WebhookEndpoint> {
  const secret = crypto.randomBytes(32).toString("hex");

  const { rows } = await sql<WebhookEndpoint>`
    INSERT INTO webhook_endpoints (org_id, url, secret, events, description)
    VALUES (${orgId}, ${url}, ${secret}, ${events as unknown as string}, ${description ?? null})
    RETURNING *
  `;

  return rows[0];
}

export async function getEndpointsByOrgAndEvent(
  orgId: string,
  eventType: string
): Promise<WebhookEndpoint[]> {
  const { rows } = await sql<WebhookEndpoint>`
    SELECT * FROM webhook_endpoints
    WHERE org_id = ${orgId}
      AND active = true
      AND ${eventType} = ANY(events)
  `;

  return rows;
}

export async function deleteWebhookEndpoint(
  id: string,
  orgId: string
): Promise<void> {
  await sql`
    DELETE FROM webhook_endpoints
    WHERE id = ${id} AND org_id = ${orgId}
  `;
}

export async function logDelivery(data: {
  webhookId: string;
  eventType: string;
  payload: Record<string, unknown>;
  statusCode: number | null;
  error: string | null;
}): Promise<void> {
  const payloadJson = JSON.stringify(data.payload);

  await sql`
    INSERT INTO webhook_deliveries (webhook_id, event_type, payload, status_code, error)
    VALUES (${data.webhookId}, ${data.eventType}, ${payloadJson}::jsonb, ${data.statusCode}, ${data.error})
  `;
}

export async function getRecentDeliveries(
  webhookId: string,
  limit: number = 20
): Promise<WebhookDelivery[]> {
  const { rows } = await sql<WebhookDelivery>`
    SELECT * FROM webhook_deliveries
    WHERE webhook_id = ${webhookId}
    ORDER BY delivered_at DESC
    LIMIT ${limit}
  `;

  return rows;
}

export async function getWebhookEndpoints(
  orgId: string
): Promise<WebhookEndpoint[]> {
  const { rows } = await sql<WebhookEndpoint>`
    SELECT * FROM webhook_endpoints
    WHERE org_id = ${orgId}
    ORDER BY created_at DESC
  `;

  return rows;
}
