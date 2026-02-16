import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth/session";
import { getOrgsForUser } from "@/lib/db/queries/organizations";

export async function GET() {
  const session = await getSession(await cookies());
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgs = await getOrgsForUser(session.userId);

  if (orgs.length > 0) {
    return NextResponse.json({
      hasOrg: true,
      orgId: orgs[0].id,
      orgLogin: orgs[0].github_org_login,
    });
  }

  return NextResponse.json({ hasOrg: false });
}
