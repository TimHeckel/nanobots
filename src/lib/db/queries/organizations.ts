import { sql } from "../index";
import type { Organization } from "../schema";

export async function createOrganization(data: {
  github_installation_id: number;
  github_org_login: string;
  github_org_id: number;
  name: string;
  avatar_url: string | null;
}): Promise<Organization> {
  const { rows } = await sql<Organization>`
    INSERT INTO organizations (github_installation_id, github_org_login, github_org_id, name, avatar_url)
    VALUES (${data.github_installation_id}, ${data.github_org_login}, ${data.github_org_id}, ${data.name}, ${data.avatar_url})
    ON CONFLICT (github_installation_id)
    DO UPDATE SET github_org_login = ${data.github_org_login}, name = ${data.name}, avatar_url = ${data.avatar_url}
    RETURNING *
  `;
  return rows[0];
}

export async function getOrgById(id: string): Promise<Organization | null> {
  const { rows } = await sql<Organization>`SELECT * FROM organizations WHERE id = ${id}`;
  return rows[0] ?? null;
}

export async function getOrgByInstallationId(installationId: number): Promise<Organization | null> {
  const { rows } = await sql<Organization>`
    SELECT * FROM organizations WHERE github_installation_id = ${installationId}
  `;
  return rows[0] ?? null;
}

export async function getOrgByGithubOrgId(githubOrgId: number): Promise<Organization | null> {
  const { rows } = await sql<Organization>`
    SELECT * FROM organizations WHERE github_org_id = ${githubOrgId}
  `;
  return rows[0] ?? null;
}

export async function getOrgsForUser(userId: string): Promise<Organization[]> {
  const { rows } = await sql<Organization>`
    SELECT o.* FROM organizations o
    JOIN org_members m ON m.org_id = o.id
    WHERE m.user_id = ${userId}
    ORDER BY o.created_at DESC
  `;
  return rows;
}

export async function updateOrg(
  id: string,
  data: Partial<Pick<Organization, "name" | "plan" | "onboarding_completed">>
): Promise<Organization | null> {
  // Build dynamic update — only update provided fields
  if (data.onboarding_completed !== undefined) {
    const { rows } = await sql<Organization>`
      UPDATE organizations SET onboarding_completed = ${data.onboarding_completed} WHERE id = ${id} RETURNING *
    `;
    return rows[0] ?? null;
  }
  if (data.plan !== undefined) {
    const { rows } = await sql<Organization>`
      UPDATE organizations SET plan = ${data.plan} WHERE id = ${id} RETURNING *
    `;
    return rows[0] ?? null;
  }
  if (data.name !== undefined) {
    const { rows } = await sql<Organization>`
      UPDATE organizations SET name = ${data.name} WHERE id = ${id} RETURNING *
    `;
    return rows[0] ?? null;
  }
  return getOrgById(id);
}
