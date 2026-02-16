import { createOpenAI } from "@ai-sdk/openai";
import { createBotFromDescription } from "../../src/lib/nanobots/ai-bots/bot-creator";
import { saveBot } from "../bots/local-store";
import type { ProviderConfig } from "../provider";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const GREEN = "\x1b[32m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";

export async function createCommand(
  description: string,
  provider: ProviderConfig,
  rootDir: string = ".",
): Promise<number> {
  if (!description) {
    process.stderr.write(
      '\n  Usage: nanobots create "description of what the bot should do"\n\n',
    );
    return 1;
  }

  if (!provider.apiKey) {
    process.stderr.write(
      "\n  Error: No API key configured.\n" +
        "  Set OPENROUTER_API_KEY or run `nanobots auth`.\n\n",
    );
    return 1;
  }

  process.stderr.write(
    `\n  ${BOLD}Creating bot...${RESET} ${DIM}${description}${RESET}\n`,
  );

  const openai = createOpenAI({
    baseURL: provider.baseUrl,
    apiKey: provider.apiKey,
  });
  const model = openai(provider.model);

  try {
    const bot = await createBotFromDescription(description, model);
    const filePath = await saveBot(bot, rootDir);

    process.stderr.write(`\n  ${GREEN}Bot created!${RESET}\n\n`);
    process.stderr.write(`  ${BOLD}Name:${RESET}        ${CYAN}${bot.name}${RESET}\n`);
    process.stderr.write(`  ${BOLD}Description:${RESET} ${bot.description}\n`);
    process.stderr.write(`  ${BOLD}Category:${RESET}    ${bot.category}\n`);
    process.stderr.write(`  ${BOLD}Status:${RESET}      ${bot.status}\n`);
    process.stderr.write(`  ${BOLD}Saved to:${RESET}    ${filePath}\n`);
    process.stderr.write(
      `\n  ${DIM}Test it with: nanobots test ${bot.name} .${RESET}\n`,
    );
    process.stderr.write(
      `  ${DIM}Then promote: nanobots promote ${bot.name}${RESET}\n\n`,
    );

    return 0;
  } catch (error) {
    process.stderr.write(`\n  Error creating bot: ${error}\n\n`);
    return 1;
  }
}
