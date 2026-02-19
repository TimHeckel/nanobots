import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken, fetchGitHubUser, fetchGitHubEmail, fetchUserOrgs } from "@/lib/auth/github-oauth";
import { findInstallationForOrgs, getInstallationOctokit } from "@/lib/github";
import { signJwt, setSessionCookie } from "@/lib/auth/session";
import { upsertUser } from "@/lib/db/queries/users";
import { getMembershipForUser, addMember } from "@/lib/db/queries/org-members";
import { acceptInvitation } from "@/lib/db/queries/invitations";
import { createOrganization } from "@/lib/db/queries/organizations";
import { createDefaultBotConfigs } from "@/lib/db/queries/bot-configs";
import { seedDefaultPrompts } from "@/lib/db/queries/system-prompts";
import { upsertRepos } from "@/lib/db/queries/org-repos";
import { logActivity } from "@/lib/db/queries/activity-log";
import { sql } from "@/lib/db";
import type { Invitation } from "@/lib/db/schema";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(new URL("/?error=missing_params", request.url));
  }

  const storedState = request.cookies.get("github-oauth-state")?.value;
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(new URL("/?error=invalid_state", request.url));
  }

  try {
    const accessToken = await exchangeCodeForToken(code);
    const [ghUser, ghEmail] = await Promise.all([
      fetchGitHubUser(accessToken),
      fetchGitHubEmail(accessToken),
    ]);

    const user = await upsertUser({
      github_id: ghUser.id,
      github_login: ghUser.login,
      name: ghUser.name,
      avatar_url: ghUser.avatar_url,
      email: ghEmail,
    });

    // 1. Check existing org memberships in our DB
    const memberships = await getMembershipForUser(user.id);

    let orgId: string | undefined;
    let role: string | undefined;

    if (memberships.length > 0) {
      orgId = memberships[0].org_id;
      role = memberships[0].role;
    } else {
      // 2. Check for pending invitations
      const pendingInvitations = await findPendingInvitations(ghUser.login);

      if (pendingInvitations.length > 0) {
        const invitation = pendingInvitations[0];
        const accepted = await acceptInvitation(invitation.id, user.id);
        if (accepted) {
          const membership = await addMember({
            org_id: invitation.org_id,
            user_id: user.id,
            role: invitation.role,
          });
          orgId = membership.org_id;
          role = membership.role;
        }
      }
    }

    // 3. If still no org, check if any of the user's GitHub orgs have
    //    the nanobots app installed (using the App's own API)
    if (!orgId) {
      const userOrgs = await fetchUserOrgs(accessToken);
      const orgLogins = [
        ...userOrgs.map((o) => o.login),
        ghUser.login, // also check personal account
      ];
      console.log(`[auth callback] Checking installations for orgs: ${orgLogins.join(", ")}`);

      const match = await findInstallationForOrgs(orgLogins);

      if (match) {
        console.log(`[auth callback] Found installation for ${match.login} (id: ${match.installationId})`);

        // Create the org in our DB
        const org = await createOrganization({
          github_installation_id: match.installationId,
          github_org_login: match.login,
          github_org_id: match.orgId,
          name: match.login,
          avatar_url: match.avatarUrl,
        });

        // Add user as admin
        const membership = await addMember({
          org_id: org.id,
          user_id: user.id,
          role: "admin",
        });

        // Fetch repos via the installation's authenticated API
        try {
          const installOctokit = await getInstallationOctokit(match.installationId);
          const { data } = await installOctokit.apps.listReposAccessibleToInstallation({
            per_page: 100,
          });
          if (data.repositories.length > 0) {
            await upsertRepos(
              org.id,
              data.repositories.map((r) => ({
                github_repo_id: r.id,
                full_name: r.full_name,
              }))
            );
          }
        } catch (err) {
          console.error("[auth callback] Failed to fetch repos:", err);
        }

        // Seed defaults
        await createDefaultBotConfigs(org.id);
        await seedDefaultPrompts();

        await logActivity(
          org.id,
          "app_installed",
          `Organization ${match.login} connected`,
          { source: "oauth_callback", installationId: match.installationId },
          user.id
        );

        orgId = org.id;
        role = membership.role;
      }
    }

    const token = await signJwt({
      userId: user.id,
      ...(orgId ? { orgId } : {}),
      ...(role ? { role } : {}),
    });

    const redirectPath = orgId ? "/chat" : "/onboarding";
    const response = NextResponse.redirect(new URL(redirectPath, request.url));

    setSessionCookie(response, token);
    response.cookies.delete("github-oauth-state");

    return response;
  } catch (error) {
    console.error("GitHub OAuth callback error:", error);
    return NextResponse.redirect(new URL("/?error=auth_failed", request.url));
  }
}

async function findPendingInvitations(githubLogin: string): Promise<Invitation[]> {
  const { rows } = await sql<Invitation>`
    SELECT * FROM invitations
    WHERE github_login = ${githubLogin}
      AND status = 'pending'
      AND expires_at > now()
    ORDER BY expires_at DESC
  `;
  return rows;
}
