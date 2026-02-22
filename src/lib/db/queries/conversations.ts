import { nanoid } from "nanoid";
import { sql } from "../index";
import type { Conversation } from "../schema";

export async function createConversation(
  orgId: string,
  userId: string,
  title: string = "New Chat"
): Promise<Conversation> {
  const id = nanoid(8);
  const { rows } = await sql<Conversation>`
    INSERT INTO conversations (id, org_id, user_id, title)
    VALUES (${id}, ${orgId}, ${userId}, ${title})
    RETURNING *
  `;
  return rows[0];
}

export async function listConversations(
  orgId: string,
  userId: string,
  limit: number = 50
): Promise<Conversation[]> {
  const { rows } = await sql<Conversation>`
    SELECT * FROM conversations
    WHERE org_id = ${orgId} AND user_id = ${userId}
    ORDER BY updated_at DESC
    LIMIT ${limit}
  `;
  return rows;
}

export async function getConversation(
  conversationId: string
): Promise<Conversation | null> {
  const { rows } = await sql<Conversation>`
    SELECT * FROM conversations WHERE id = ${conversationId}
  `;
  return rows[0] ?? null;
}

export async function updateConversationTitle(
  conversationId: string,
  title: string
): Promise<void> {
  await sql`
    UPDATE conversations SET title = ${title}, updated_at = now()
    WHERE id = ${conversationId}
  `;
}

export async function touchConversation(
  conversationId: string
): Promise<void> {
  await sql`
    UPDATE conversations SET updated_at = now()
    WHERE id = ${conversationId}
  `;
}

export async function deleteConversation(
  conversationId: string,
  orgId: string
): Promise<void> {
  await sql`
    DELETE FROM conversations
    WHERE id = ${conversationId} AND org_id = ${orgId}
  `;
}
