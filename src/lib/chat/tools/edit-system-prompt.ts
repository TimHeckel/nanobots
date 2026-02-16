import { tool } from "ai";
import { z } from "zod";
import {
  getSystemPrompt,
  upsertSystemPrompt,
  createVersion,
  getVersionCount,
} from "@/lib/db/queries/system-prompts";
import { logActivity } from "@/lib/db/queries/activity-log";

export function editSystemPromptToolDef(
  orgId: string,
  userId: string,
  role: string
) {
  return tool({
    description: "View or edit a bot's system prompt",
    inputSchema: z.object({
      agentName: z.string().describe("The name of the agent/bot"),
      newPrompt: z
        .string()
        .optional()
        .describe(
          "The new prompt text. If omitted, the current prompt is returned."
        ),
    }),
    execute: async ({ agentName, newPrompt }) => {
      // View mode
      if (!newPrompt) {
        const prompt = await getSystemPrompt(orgId, agentName);
        if (!prompt) {
          return {
            error: `No system prompt found for agent "${agentName}".`,
          };
        }
        return {
          agentName: prompt.agent_name,
          promptText: prompt.prompt_text,
          updatedAt: prompt.updated_at,
          isGlobal: prompt.org_id === null,
        };
      }

      // Edit mode - admin only
      if (role !== "admin") {
        return { error: "Only admins can edit system prompts." };
      }

      const updatedPrompt = await upsertSystemPrompt(
        orgId,
        agentName,
        newPrompt,
        userId
      );

      // Create a version record
      const versionCount = await getVersionCount(updatedPrompt.id);
      await createVersion(
        updatedPrompt.id,
        versionCount + 1,
        newPrompt,
        "Manual edit via chat",
        userId
      );

      await logActivity(
        orgId,
        "prompt.edited",
        `Updated system prompt for ${agentName}`,
        { agentName },
        userId
      );

      return {
        success: true,
        agentName: updatedPrompt.agent_name,
        message: `System prompt for "${agentName}" has been updated.`,
      };
    },
  });
}
