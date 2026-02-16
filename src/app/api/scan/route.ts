import { NextRequest, NextResponse } from "next/server";
import { runAllNanobots } from "@/lib/nanobots/orchestrator";

/**
 * Manual scan trigger for testing.
 *
 * POST /api/scan
 * Body: { "installationId": 12345, "owner": "yourname", "repo": "yourrepo" }
 *
 * Or use query params:
 * GET /api/scan?installationId=12345&owner=yourname&repo=yourrepo
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { installationId, owner, repo } = body;

  if (!installationId || !owner || !repo) {
    return NextResponse.json(
      { error: "Missing required fields: installationId, owner, repo" },
      { status: 400 }
    );
  }

  try {
    const prUrls = await runAllNanobots(Number(installationId), owner, repo);
    return NextResponse.json({
      ok: true,
      repo: `${owner}/${repo}`,
      prsCreated: prUrls.length,
      prUrls,
    });
  } catch (err) {
    console.error("[scan] Error:", err);
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const installationId = url.searchParams.get("installationId");
  const owner = url.searchParams.get("owner");
  const repo = url.searchParams.get("repo");

  if (!installationId || !owner || !repo) {
    return NextResponse.json(
      {
        error: "Missing query params: installationId, owner, repo",
        usage: "GET /api/scan?installationId=123&owner=yourname&repo=yourrepo",
      },
      { status: 400 }
    );
  }

  try {
    const prUrls = await runAllNanobots(Number(installationId), owner, repo);
    return NextResponse.json({
      ok: true,
      repo: `${owner}/${repo}`,
      prsCreated: prUrls.length,
      prUrls,
    });
  } catch (err) {
    console.error("[scan] Error:", err);
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
