import { sql } from "../index";
import type { Invitation } from "../schema";

export async function createInvitation(
  orgId: string,
  githubLogin: string,
  role: "admin" | "member",
  invitedBy: string
): Promise<Invitation> {
  const { rows } = await sql<Invitation>`
    INSERT INTO invitations (org_id, github_login, role, invited_by)
    VALUES (${orgId}, ${githubLogin}, ${role}, ${invitedBy})
    RETURNING *
  `;
  return rows[0];
}

export async function getPendingInvitations(orgId: string): Promise<Invitation[]> {
  const { rows } = await sql<Invitation>`
    SELECT * FROM invitations
    WHERE org_id = ${orgId} AND status = 'pending' AND expires_at > now()
    ORDER BY expires_at DESC
  `;
  return rows;
}

export async function acceptInvitation(id: string, userId: string): Promise<Invitation | null> {
  // We don't use userId in the update itself but it's for future audit logging
  void userId;
  const { rows } = await sql<Invitation>`
    UPDATE invitations SET status = 'accepted'
    WHERE id = ${id} AND status = 'pending' AND expires_at > now()
    RETURNING *
  `;
  return rows[0] ?? null;
}

export async function getInvitationForUser(orgId: string, githubLogin: string): Promise<Invitation | null> {
  const { rows } = await sql<Invitation>`
    SELECT * FROM invitations
    WHERE org_id = ${orgId} AND github_login = ${githubLogin} AND status = 'pending' AND expires_at > now()
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function expireOldInvitations(): Promise<number> {
  const { rowCount } = await sql`
    UPDATE invitations SET status = 'expired'
    WHERE status = 'pending' AND expires_at <= now()
  `;
  return rowCount ?? 0;
}
