import { tool } from "ai";
import { z } from "zod";
import { createInvitation } from "@/lib/db/queries/invitations";
import { logActivity } from "@/lib/db/queries/activity-log";

export function inviteMemberToolDef(
  orgId: string,
  userId: string,
  role: string
) {
  return tool({
    description: "Invite a team member by GitHub username",
    inputSchema: z.object({
      githubLogin: z.string().describe("GitHub username to invite"),
      role: z
        .enum(["admin", "member"])
        .describe('Role for the invited user: "admin" or "member"'),
    }),
    execute: async ({ githubLogin, role: inviteRole }) => {
      if (role !== "admin") {
        return { error: "Only admins can invite team members." };
      }

      try {
        const invitation = await createInvitation(
          orgId,
          githubLogin,
          inviteRole,
          userId
        );

        await logActivity(
          orgId,
          "member.invited",
          `Invited ${githubLogin} as ${inviteRole}`,
          { githubLogin, role: inviteRole },
          userId
        );

        return {
          success: true,
          message: `Invitation sent to ${githubLogin} as ${inviteRole}.`,
          invitationId: invitation.id,
          expiresAt: invitation.expires_at,
        };
      } catch (err) {
        return {
          error: `Failed to create invitation: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    },
  });
}
