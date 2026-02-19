import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getUserById } from "@/lib/db/queries/users";
import { getOrgById } from "@/lib/db/queries/organizations";
import { isPlatformAdmin } from "@/lib/auth/platform-admin";

export async function GET(request: NextRequest) {
  const session = await getSession(request.cookies);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getUserById(session.userId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 401 });
  }

  let org = null;
  if (session.orgId) {
    org = await getOrgById(session.orgId);
  }

  return NextResponse.json({
    user: {
      id: user.id,
      githubLogin: user.github_login,
      name: user.name,
      avatarUrl: user.avatar_url,
    },
    org: org
      ? {
          id: org.id,
          name: org.name,
          githubOrgLogin: org.github_org_login,
          avatarUrl: org.avatar_url,
          plan: org.plan,
        }
      : null,
    role: session.role ?? null,
    isPlatformAdmin: isPlatformAdmin(user.email),
  });
}
