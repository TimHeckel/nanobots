import type { BotDefinition } from "../src/lib/nanobots/ai-bots/types";

export function buildCliSystemPrompt(bots: BotDefinition[]): string {
  const sections: string[] = [];

  sections.push(
    `You are the nanobots CLI assistant. You help users manage bots, scan code for issues, and create custom bots — all from the terminal.`
  );

  sections.push(
    `You operate on the local filesystem. Bots are stored in .nanobots/bots/ as JSON files. Built-in bots are always available.`
  );

  // List available bots
  if (bots.length > 0) {
    const botLines = bots.map(
      (b) => `- ${b.name} [${b.status}] (${b.category}): ${b.description}`
    );
    sections.push(`Available bots:\n${botLines.join("\n")}`);
  }

  sections.push(
    `Bot lifecycle: draft → testing → active → archived. Use createBot to create, testBot to validate, then the promote CLI command to advance.`
  );

  sections.push(
    `Available tools:\n` +
    `- listBots: Show all available bots (built-in + custom)\n` +
    `- describeBot: Get full details about a bot\n` +
    `- createBot: Create a new custom bot from a description\n` +
    `- testBot: Test a bot against local files\n` +
    `- scan: Run all active bots (or a filtered set) against local files`
  );

  sections.push(
    `Keep responses concise. When showing findings, format them clearly with severity, file path, and description.`
  );

  return sections.join("\n\n");
}
