import { generateText, type LanguageModel } from "ai";
import type { BotDefinition } from "./types";

const BOT_DESIGNER_PROMPT_DEFAULT = `You are an expert bot designer for nanobots, an AI-native code scanner.
You help create new scanning bots by generating complete bot definitions.

A bot definition is a JSON object with:
- name: kebab-case identifier (e.g. "todo-finder")
- description: one-line description
- category: "security" | "quality" | "docs"
- systemPrompt: the full system prompt the bot will use for analysis
- config: { fileExtensions: [".ts", ...], outputFormat: "findings" | "document", maxFilesPerBatch: 15 }
- tools: optional array of tool definitions (for advanced bots that need HTTP calls or regex matching)

The system prompt should instruct the bot to:
1. Analyze source files for specific patterns
2. Return findings as JSON with: file, line, severity, category, description, suggestion
3. Be precise and avoid false positives

Respond with a valid JSON bot definition.
Respond ONLY with valid JSON. No markdown fences, no explanation outside the JSON.`;

export async function getBotDesignerPrompt(): Promise<string> {
  try {
    const { getGlobalDefault } = await import("@/lib/db/queries/system-prompts");
    const dbPrompt = await getGlobalDefault("bot-designer");
    return dbPrompt?.prompt_text ?? BOT_DESIGNER_PROMPT_DEFAULT;
  } catch {
    return BOT_DESIGNER_PROMPT_DEFAULT;
  }
}

export async function createBotFromDescription(
  description: string,
  model: LanguageModel,
): Promise<BotDefinition> {
  const systemPrompt = await getBotDesignerPrompt();
  const { text } = await generateText({
    model,
    system: systemPrompt,
    prompt: `Create a bot for the following purpose:\n\n${description}`,
  });

  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const parsed = JSON.parse(cleaned);

  // Ensure required fields and set defaults
  const bot: BotDefinition = {
    name: String(parsed.name ?? "custom-bot"),
    description: String(parsed.description ?? description),
    category: parsed.category ?? "quality",
    systemPrompt: String(parsed.systemPrompt ?? ""),
    tools: parsed.tools ?? undefined,
    config: {
      fileExtensions: parsed.config?.fileExtensions ?? [".ts", ".tsx", ".js", ".jsx"],
      outputFormat: parsed.config?.outputFormat ?? "findings",
      maxFilesPerBatch: parsed.config?.maxFilesPerBatch ?? 15,
      maxSteps: parsed.config?.maxSteps ?? 5,
    },
    status: "draft",
    source: "user",
    createdAt: new Date().toISOString(),
  };

  if (!bot.systemPrompt) {
    throw new Error("Bot designer failed to generate a system prompt");
  }

  return bot;
}
