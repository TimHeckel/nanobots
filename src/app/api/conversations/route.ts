import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  createConversation,
  listConversations,
} from "@/lib/db/queries/conversations";

export async function GET() {
  const session = await getSession(await cookies());
  if (!session?.userId || !session?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const conversations = await listConversations(session.orgId, session.userId);
  return NextResponse.json({ conversations });
}

export async function POST(req: NextRequest) {
  const session = await getSession(await cookies());
  if (!session?.userId || !session?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const title = body.title || "New Chat";

  const conversation = await createConversation(
    session.orgId,
    session.userId,
    title
  );
  return NextResponse.json({ conversation }, { status: 201 });
}
