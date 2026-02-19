import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserById } from "@/lib/db/queries/users";
import { isPlatformAdmin } from "@/lib/auth/platform-admin";
import {
  getAllGlobalPrompts,
  HARDCODED_DEFAULTS,
  PROMPT_CATEGORIES,
} from "@/lib/db/queries/system-prompts";

export async function GET(request: NextRequest) {
  const session = await getSession(request.cookies);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserById(session.userId);
  if (!user || !isPlatformAdmin(user.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const dbPrompts = await getAllGlobalPrompts();
  const dbMap = new Map(dbPrompts.map((p) => [p.agent_name, p]));

  // Merge DB prompts with hardcoded defaults — DB wins
  const allPrompts = Object.entries(HARDCODED_DEFAULTS).map(
    ([agentName, defaultText]) => {
      const dbPrompt = dbMap.get(agentName);
      const meta = PROMPT_CATEGORIES[agentName];
      return {
        agentName,
        promptText: dbPrompt?.prompt_text ?? defaultText,
        category: meta?.category ?? "Other",
        description: meta?.description ?? agentName,
        updatedAt: dbPrompt?.updated_at ?? null,
        isCustomized: !!dbPrompt,
      };
    },
  );

  // Include any DB-only prompts not in HARDCODED_DEFAULTS
  for (const dbPrompt of dbPrompts) {
    if (!HARDCODED_DEFAULTS[dbPrompt.agent_name]) {
      const meta = PROMPT_CATEGORIES[dbPrompt.agent_name];
      allPrompts.push({
        agentName: dbPrompt.agent_name,
        promptText: dbPrompt.prompt_text,
        category: meta?.category ?? "Other",
        description: meta?.description ?? dbPrompt.agent_name,
        updatedAt: dbPrompt.updated_at,
        isCustomized: true,
      });
    }
  }

  return NextResponse.json({ prompts: allPrompts });
}
