import { z } from "zod";

export function inviteMemberToolDef(
  orgId: string,
  userId: string,
  role: string
) {
  return {
    description: "Invite a control-room team member",
    inputSchema: z.object({
      githubLogin: z.string(),
      role: z.enum(["admin", "member"]),
    }),
    execute: async ({
      githubLogin,
      role: inviteRole,
    }: {
      githubLogin: string;
      role: "admin" | "member";
    }) => {
      if (role !== "admin") {
        return {
          success: false,
          orgId,
          userId,
          error: "Only admins can invite control-room team members.",
        };
      }

      return {
        success: true,
        orgId,
        userId,
        invitation: {
          githubLogin,
          role: inviteRole,
          status: "pending",
        },
        message: `Invitation sent to ${githubLogin} as ${inviteRole}.`,
      };
    },
  };
}
