import { NextRequest, NextResponse } from "next/server";
import { resolveApiKey } from "@/lib/db/queries/api-keys";
import { createWebhookHandler } from "@/lib/webhooks/dispatcher";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing API key" }, { status: 401 });
  }

  const key = authHeader.slice(7);
  const result = await resolveApiKey(key);
  if (!result) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  const event = await req.json();

  // Process event async — respond immediately
  const handler = createWebhookHandler(result.orgId);
  handler(event);

  return NextResponse.json({ ok: true }, { status: 202 });
}
