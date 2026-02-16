import { sql } from "../index";
import type { Swarm, SwarmBot } from "../schema";

export interface SwarmWithBots extends Swarm {
  bot_names: string[];
  bot_count: number;
}

export async function createSwarm(
  orgId: string,
  name: string,
  description: string | null,
  createdBy: string | null
): Promise<Swarm> {
  const { rows } = await sql<Swarm>`
    INSERT INTO swarms (org_id, name, description, created_by)
    VALUES (${orgId}, ${name}, ${description}, ${createdBy})
    RETURNING *
  `;
  return rows[0];
}

export async function addBotToSwarm(
  swarmId: string,
  botName: string
): Promise<void> {
  await sql`
    INSERT INTO swarm_bots (swarm_id, bot_name)
    VALUES (${swarmId}, ${botName})
    ON CONFLICT (swarm_id, bot_name) DO NOTHING
  `;
}

export async function removeBotFromSwarm(
  swarmId: string,
  botName: string
): Promise<void> {
  await sql`
    DELETE FROM swarm_bots
    WHERE swarm_id = ${swarmId} AND bot_name = ${botName}
  `;
}

export async function getSwarmByName(
  orgId: string,
  name: string
): Promise<SwarmWithBots | null> {
  const { rows } = await sql<Swarm>`
    SELECT * FROM swarms WHERE org_id = ${orgId} AND name = ${name}
  `;
  if (rows.length === 0) return null;

  const swarm = rows[0];
  const botNames = await getSwarmBots(swarm.id);

  return { ...swarm, bot_names: botNames, bot_count: botNames.length };
}

export async function listSwarms(orgId: string): Promise<SwarmWithBots[]> {
  const { rows } = await sql<Swarm>`
    SELECT * FROM swarms WHERE org_id = ${orgId} ORDER BY created_at DESC
  `;

  const result: SwarmWithBots[] = [];
  for (const swarm of rows) {
    const botNames = await getSwarmBots(swarm.id);
    result.push({ ...swarm, bot_names: botNames, bot_count: botNames.length });
  }

  return result;
}

export async function getSwarmBots(swarmId: string): Promise<string[]> {
  const { rows } = await sql<SwarmBot>`
    SELECT * FROM swarm_bots WHERE swarm_id = ${swarmId} ORDER BY bot_name
  `;
  return rows.map((r) => r.bot_name);
}

export async function deleteSwarm(
  swarmId: string,
  orgId: string
): Promise<void> {
  await sql`
    DELETE FROM swarms WHERE id = ${swarmId} AND org_id = ${orgId}
  `;
}
