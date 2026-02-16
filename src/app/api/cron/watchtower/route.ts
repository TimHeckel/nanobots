import { NextRequest, NextResponse } from "next/server";
import { runWatchtower } from "@/lib/watchtower";

function authenticate(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // No secret configured, allow all

  const header = req.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

function parseParams(req: NextRequest) {
  const url = new URL(req.url);
  const installationId = url.searchParams.get("installationId");
  const owner = url.searchParams.get("owner");
  const repo = url.searchParams.get("repo");

  return { installationId, owner, repo };
}

export async function GET(req: NextRequest) {
  if (!authenticate(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { installationId, owner, repo } = parseParams(req);

  if (!installationId || !owner || !repo) {
    return NextResponse.json(
      {
        error: "Missing query params: installationId, owner, repo",
        usage: "GET /api/cron/watchtower?installationId=123&owner=yourname&repo=yourrepo",
      },
      { status: 400 }
    );
  }

  try {
    const result = await runWatchtower(Number(installationId), owner, repo);
    return NextResponse.json({
      ok: true,
      repo: `${owner}/${repo}`,
      threatsFound: result.matches.length,
      advisoriesChecked: result.advisoriesChecked,
      dependenciesIndexed: result.dependenciesIndexed,
      sources: result.sources,
    });
  } catch (err) {
    console.error("[watchtower] Cron error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!authenticate(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let installationId: string | null;
  let owner: string | null;
  let repo: string | null;

  const contentType = req.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    const body = await req.json();
    installationId = body.installationId?.toString() ?? null;
    owner = body.owner ?? null;
    repo = body.repo ?? null;
  } else {
    ({ installationId, owner, repo } = parseParams(req));
  }

  if (!installationId || !owner || !repo) {
    return NextResponse.json(
      { error: "Missing required fields: installationId, owner, repo" },
      { status: 400 }
    );
  }

  try {
    const result = await runWatchtower(Number(installationId), owner, repo);
    return NextResponse.json({
      ok: true,
      repo: `${owner}/${repo}`,
      threatsFound: result.matches.length,
      advisoriesChecked: result.advisoriesChecked,
      dependenciesIndexed: result.dependenciesIndexed,
      sources: result.sources,
    });
  } catch (err) {
    console.error("[watchtower] Cron error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
