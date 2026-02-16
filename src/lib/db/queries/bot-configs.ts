import { sql } from "../index";
import type { BotConfig } from "../schema";
import { BOT_NAMES } from "../schema";

export async function createDefaultBotConfigs(orgId: string): Promise<void> {
  for (const botName of BOT_NAMES) {
    await sql`
      INSERT INTO bot_configs (org_id, bot_name, enabled)
      VALUES (${orgId}, ${botName}, true)
      ON CONFLICT (org_id, bot_name) DO NOTHING
    `;
  }
}

export async function getBotConfigs(orgId: string): Promise<BotConfig[]> {
  const { rows } = await sql<BotConfig>`
    SELECT * FROM bot_configs WHERE org_id = ${orgId} ORDER BY bot_name
  `;
  return rows;
}

export async function toggleBot(orgId: string, botName: string, enabled: boolean): Promise<BotConfig | null> {
  const { rows } = await sql<BotConfig>`
    UPDATE bot_configs SET enabled = ${enabled}
    WHERE org_id = ${orgId} AND bot_name = ${botName}
    RETURNING *
  `;
  return rows[0] ?? null;
}

export async function getEnabledBots(orgId: string): Promise<string[]> {
  const { rows } = await sql<{ bot_name: string }>`
    SELECT bot_name FROM bot_configs WHERE org_id = ${orgId} AND enabled = true ORDER BY bot_name
  `;
  return rows.map((r) => r.bot_name);
}

export async function upsertBotConfig(
  orgId: string,
  botName: string,
  enabled: boolean
): Promise<BotConfig> {
  const { rows } = await sql<BotConfig>`
    INSERT INTO bot_configs (org_id, bot_name, enabled)
    VALUES (${orgId}, ${botName}, ${enabled})
    ON CONFLICT (org_id, bot_name)
    DO UPDATE SET enabled = ${enabled}
    RETURNING *
  `;
  return rows[0];
}
