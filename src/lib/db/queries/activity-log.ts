import { sql } from "../index";
import type { ActivityLogEntry } from "../schema";

export async function logActivity(
  orgId: string,
  eventType: string,
  summary: string,
  metadata?: Record<string, unknown>,
  actorId?: string
): Promise<ActivityLogEntry> {
  const metadataJson = metadata ? JSON.stringify(metadata) : null;
  const { rows } = await sql<ActivityLogEntry>`
    INSERT INTO activity_log (org_id, event_type, summary, metadata, actor_id)
    VALUES (${orgId}, ${eventType}, ${summary}, ${metadataJson}::jsonb, ${actorId ?? null})
    RETURNING *
  `;
  return rows[0];
}

export async function getRecentActivity(orgId: string, limit: number = 20): Promise<ActivityLogEntry[]> {
  const { rows } = await sql<ActivityLogEntry>`
    SELECT * FROM activity_log
    WHERE org_id = ${orgId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return rows;
}
