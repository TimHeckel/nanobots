import crypto from "crypto";
import { sql } from "../index";
import type { ApiKey } from "../schema";

export async function createApiKey(
  orgId: string,
  label: string
): Promise<{ key: string; id: string }> {
  const raw = `nbk_${crypto.randomBytes(32).toString("hex")}`;
  const keyHash = crypto.createHash("sha256").update(raw).digest("hex");

  const { rows } = await sql<ApiKey>`
    INSERT INTO api_keys (org_id, key_hash, label)
    VALUES (${orgId}, ${keyHash}, ${label})
    RETURNING *
  `;

  return { key: raw, id: rows[0].id };
}

export async function resolveApiKey(
  key: string
): Promise<{ orgId: string } | null> {
  const keyHash = crypto.createHash("sha256").update(key).digest("hex");

  const { rows } = await sql<ApiKey>`
    SELECT * FROM api_keys
    WHERE key_hash = ${keyHash}
  `;

  if (rows.length === 0) return null;
  return { orgId: rows[0].org_id };
}
