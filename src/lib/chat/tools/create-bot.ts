import { tool } from "ai";
import { z } from "zod";
import { upsertSystemPrompt } from "@/lib/db/queries/system-prompts";
import { upsertBotConfig } from "@/lib/db/queries/bot-configs";
export function createBotToolDef(orgId: string, userId: string) {
  return tool({
    description:
      "Create a new custom nanobot with a name, description, system prompt, and configuration. The bot starts in 'draft' status.",
    inputSchema: z.object({
      name: z
        .string()
        .describe("Kebab-case name for the bot (e.g. 'todo-finder')"),
      description: z.string().describe("One-line description of what the bot does"),
      category: z
        .enum(["security", "quality", "docs"])
        .describe("Bot category"),
      systemPrompt: z
        .string()
        .describe("The system prompt the bot will use for analysis"),
      fileExtensions: z
        .array(z.string())
        .optional()
        .describe(
          "File extensions to scan (e.g. [\".ts\", \".js\"]). Defaults to common source files.",
        ),
    }),
    execute: async ({ name, description, category, systemPrompt }) => {
      const prompt = await upsertSystemPrompt(
        orgId,
        name,
        systemPrompt,
        userId,
      );

      // Create bot_configs row so the bot appears in listBots (disabled by default as draft)
      await upsertBotConfig(orgId, name, false);

      return {
        success: true,
        bot: {
          name,
          description,
          category,
          status: "draft",
          promptId: prompt.id,
        },
        message: `Bot "${name}" created as draft. Test it with the testBot tool, then promote it.`,
      };
    },
  });
}
