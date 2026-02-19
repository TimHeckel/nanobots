import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getBotConfigs } from "@/lib/db/queries/bot-configs";
import { listSwarms } from "@/lib/db/queries/swarms";

export async function GET(request: NextRequest) {
  const session = await getSession(request.cookies);

  if (!session?.userId || !session?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [botConfigs, swarms] = await Promise.all([
    getBotConfigs(session.orgId),
    listSwarms(session.orgId),
  ]);

  return NextResponse.json({
    bots: botConfigs,
    swarms: swarms.map((s) => ({
      name: s.name,
      description: s.description,
      botCount: s.bot_count,
      bots: s.bot_names,
    })),
  });
}
