import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserById } from "@/lib/db/queries/users";
import { isPlatformAdmin } from "@/lib/auth/platform-admin";
import {
  getGlobalDefault,
  upsertSystemPrompt,
  createVersion,
  getVersionCount,
  HARDCODED_DEFAULTS,
  PROMPT_CATEGORIES,
} from "@/lib/db/queries/system-prompts";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentName: string }> },
) {
  const session = await getSession(request.cookies);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserById(session.userId);
  if (!user || !isPlatformAdmin(user.email, user.github_login)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { agentName } = await params;
  const dbPrompt = await getGlobalDefault(agentName);
  const hardcoded = HARDCODED_DEFAULTS[agentName];
  const meta = PROMPT_CATEGORIES[agentName];

  if (!dbPrompt && !hardcoded) {
    return NextResponse.json({ error: "Prompt not found" }, { status: 404 });
  }

  return NextResponse.json({
    agentName,
    promptText: dbPrompt?.prompt_text ?? hardcoded,
    category: meta?.category ?? "Other",
    description: meta?.description ?? agentName,
    updatedAt: dbPrompt?.updated_at ?? null,
    isCustomized: !!dbPrompt,
    hardcodedDefault: hardcoded ?? null,
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ agentName: string }> },
) {
  const session = await getSession(request.cookies);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserById(session.userId);
  if (!user || !isPlatformAdmin(user.email, user.github_login)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { agentName } = await params;
  const body = await request.json();
  const { promptText, changeReason } = body;

  if (!promptText || typeof promptText !== "string") {
    return NextResponse.json(
      { error: "promptText is required" },
      { status: 400 },
    );
  }

  const updated = await upsertSystemPrompt(
    null,
    agentName,
    promptText,
    session.userId,
  );

  const versionCount = await getVersionCount(updated.id);
  await createVersion(
    updated.id,
    versionCount + 1,
    promptText,
    changeReason ?? null,
    session.userId,
  );

  return NextResponse.json({
    agentName,
    promptText: updated.prompt_text,
    updatedAt: updated.updated_at,
  });
}
