import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getMessagesByConversation } from "@/lib/db/queries/chat-messages";
import type { ChatMessage } from "@/lib/db/schema";

interface UIMessagePart {
  type: "text";
  text: string;
}

interface UIMessage {
  id: string;
  role: "user" | "assistant";
  parts: UIMessagePart[];
  createdAt: string;
}

function toUIMessages(rows: ChatMessage[]): UIMessage[] {
  return rows
    .filter((r) => r.role === "user" || r.role === "assistant")
    .filter((r) => r.content)
    .map((r) => ({
      id: r.id,
      role: r.role as "user" | "assistant",
      parts: [{ type: "text" as const, text: r.content! }],
      createdAt: new Date(r.created_at).toISOString(),
    }));
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(await cookies());
  if (!session?.userId || !session?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const rows = await getMessagesByConversation(id);
  const messages = toUIMessages(rows);
  return NextResponse.json({ messages });
}
