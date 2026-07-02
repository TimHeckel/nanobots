import { z } from "zod";

export function editSystemPromptToolDef(
  orgId: string,
  userId: string,
  role: string
) {
  return {
    description: "View or update a control-room prompt draft",
    inputSchema: z.object({
      agentName: z.string(),
      newPrompt: z.string().optional(),
    }),
    execute: async ({
      agentName,
      newPrompt,
    }: {
      agentName: string;
      newPrompt?: string;
    }) => {
      if (!newPrompt) {
        return {
          orgId,
          agentName,
          promptText: `Prompt preview for ${agentName}.`,
          mode: "view",
          isEditable: role === "admin",
        };
      }

      if (role !== "admin") {
        return {
          success: false,
          orgId,
          userId,
          agentName,
          error: "Only admins can update control-room prompts.",
        };
      }

      return {
        success: true,
        orgId,
        userId,
        agentName,
        promptText: newPrompt,
        message: `Prompt for "${agentName}" updated.`,
      };
    },
  };
}
