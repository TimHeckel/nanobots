import { sql } from "../index";
import type { ChatMessage } from "../schema";

export async function saveMessage(
  orgId: string,
  userId: string,
  role: "user" | "assistant" | "tool",
  content: string | null,
  toolCalls?: unknown,
  conversationId?: string
): Promise<ChatMessage> {
  const { rows } = await sql<ChatMessage>`
    INSERT INTO chat_messages (org_id, user_id, role, content, tool_calls, conversation_id)
    VALUES (${orgId}, ${userId}, ${role}, ${content}, ${toolCalls ? JSON.stringify(toolCalls) : null}::jsonb, ${conversationId ?? null})
    RETURNING *
  `;
  return rows[0];
}

export async function getMessageHistory(
  orgId: string,
  userId: string,
  limit: number = 50
): Promise<ChatMessage[]> {
  const { rows } = await sql<ChatMessage>`
    SELECT * FROM chat_messages
    WHERE org_id = ${orgId} AND user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  // Return in chronological order
  return rows.reverse();
}

export async function getMessagesByConversation(
  conversationId: string,
  limit: number = 100
): Promise<ChatMessage[]> {
  const { rows } = await sql<ChatMessage>`
    SELECT * FROM chat_messages
    WHERE conversation_id = ${conversationId}
    ORDER BY created_at ASC
    LIMIT ${limit}
  `;
  return rows;
}

export async function clearHistory(orgId: string, userId: string): Promise<void> {
  await sql`DELETE FROM chat_messages WHERE org_id = ${orgId} AND user_id = ${userId}`;
}
