import { sql } from "../index";
import type { OrgMember } from "../schema";

export async function addMember(data: {
  org_id: string;
  user_id: string;
  role: "admin" | "member";
}): Promise<OrgMember> {
  const { rows } = await sql<OrgMember>`
    INSERT INTO org_members (org_id, user_id, role)
    VALUES (${data.org_id}, ${data.user_id}, ${data.role})
    ON CONFLICT (org_id, user_id)
    DO UPDATE SET role = ${data.role}
    RETURNING *
  `;
  return rows[0];
}

export async function getMembersForOrg(orgId: string): Promise<Array<OrgMember & { github_login: string; name: string | null; avatar_url: string | null }>> {
  const { rows } = await sql<OrgMember & { github_login: string; name: string | null; avatar_url: string | null }>`
    SELECT m.*, u.github_login, u.name, u.avatar_url
    FROM org_members m
    JOIN users u ON u.id = m.user_id
    WHERE m.org_id = ${orgId}
    ORDER BY m.joined_at ASC
  `;
  return rows;
}

export async function getMembershipForUser(userId: string): Promise<Array<OrgMember & { org_name: string; org_login: string }>> {
  const { rows } = await sql<OrgMember & { org_name: string; org_login: string }>`
    SELECT m.*, o.name AS org_name, o.github_org_login AS org_login
    FROM org_members m
    JOIN organizations o ON o.id = m.org_id
    WHERE m.user_id = ${userId}
    ORDER BY m.joined_at DESC
  `;
  return rows;
}

export async function getUserOrgMembership(userId: string, orgId: string): Promise<OrgMember | null> {
  const { rows } = await sql<OrgMember>`
    SELECT * FROM org_members WHERE user_id = ${userId} AND org_id = ${orgId}
  `;
  return rows[0] ?? null;
}

export async function removeMember(orgId: string, userId: string): Promise<void> {
  await sql`DELETE FROM org_members WHERE org_id = ${orgId} AND user_id = ${userId}`;
}
