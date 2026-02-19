import { createInterface } from "node:readline";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, stepCountIs } from "ai";
import type { ModelMessage } from "ai";
import { resolve } from "node:path";
import { loadConfig } from "../config";
import { defaultProviderConfig } from "../provider";
import { createRegistry } from "../../src/lib/nanobots/ai-bots/registry";
import { loadLocalBots } from "../bots/local-store";
import { buildCliSystemPrompt } from "../chat-prompt";
import { createChatTools } from "../chat-tools";
import type { ParsedFlags } from "../flags";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const CYAN = "\x1b[36m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";

export async function chatCommand(flags: ParsedFlags): Promise<number> {
  const targetDir = resolve(flags.args[0] ?? ".");
  const config = await loadConfig(targetDir);

  const provider = {
    ...defaultProviderConfig(),
    apiKey: config.apiKey || process.env.OPENROUTER_API_KEY || "",
    model: flags.model ?? config.model,
  };

  if (!provider.apiKey) {
    process.stderr.write(
      "\n  Error: No API key configured.\n" +
      "  Set OPENROUTER_API_KEY or run `nanobots auth`.\n\n",
    );
    return 1;
  }

  const openai = createOpenAI({
    baseURL: provider.baseUrl,
    apiKey: provider.apiKey,
  });
  const model = openai.chat(provider.model);

  // Load bots for system prompt context
  const userBots = await loadLocalBots(targetDir);
  const registry = createRegistry(userBots);
  const allBots = registry.getAll();

  const systemPrompt = buildCliSystemPrompt(allBots);
  const tools = createChatTools(targetDir, provider, model);

  // Print welcome banner
  process.stderr.write(`\n  ${BOLD}nanobots chat${RESET} ${DIM}(${provider.model})${RESET}\n`);
  process.stderr.write(`  ${DIM}Type your message, or "exit" to quit.${RESET}\n\n`);

  const messages: ModelMessage[] = [];

  const rl = createInterface({
    input: process.stdin,
    output: process.stderr,
    prompt: `  ${GREEN}you>${RESET} `,
  });

  return new Promise<number>((resolvePromise) => {
    rl.prompt();

    rl.on("line", async (line) => {
      const userInput = line.trim();

      if (!userInput) {
        rl.prompt();
        return;
      }

      if (userInput === "exit" || userInput === "quit") {
        process.stderr.write(`\n  ${DIM}Goodbye!${RESET}\n\n`);
        rl.close();
        resolvePromise(0);
        return;
      }

      messages.push({ role: "user", content: userInput });

      try {
        process.stderr.write(`\n  ${DIM}thinking...${RESET}`);

        const result = await generateText({
          model,
          system: systemPrompt,
          messages,
          tools,
          stopWhen: stepCountIs(5),
        });

        // Clear "thinking..." line
        process.stderr.write("\r\x1b[K");

        // Show tool calls from steps
        for (const step of result.steps) {
          if (step.toolCalls && step.toolCalls.length > 0) {
            for (const call of step.toolCalls) {
              process.stderr.write(`  ${YELLOW}[tool]${RESET} ${CYAN}${call.toolName}${RESET}`);
              const callInput = call.input as Record<string, unknown>;
              const inputKeys = Object.keys(callInput).filter((k) => callInput[k] !== undefined);
              if (inputKeys.length > 0) {
                const brief = inputKeys.map((k) => `${k}=${JSON.stringify(callInput[k])}`).join(", ");
                process.stderr.write(` ${DIM}${brief.slice(0, 80)}${brief.length > 80 ? "..." : ""}${RESET}`);
              }
              process.stderr.write("\n");
            }
          }
          if (step.toolResults && step.toolResults.length > 0) {
            for (const tr of step.toolResults) {
              const res = tr.output as Record<string, unknown>;
              if (res?.error) {
                process.stderr.write(`  ${YELLOW}[result]${RESET} error: ${res.error}\n`);
              } else if (res?.message) {
                process.stderr.write(`  ${YELLOW}[result]${RESET} ${res.message}\n`);
              }
            }
          }
        }

        // Print assistant response
        if (result.text) {
          process.stderr.write(`\n  ${BOLD}assistant>${RESET} ${result.text}\n`);
        }

        // Add assistant response to conversation history
        messages.push({ role: "assistant", content: result.text || "" });

      } catch (err) {
        process.stderr.write("\r\x1b[K");
        process.stderr.write(`  ${YELLOW}Error: ${err instanceof Error ? err.message : String(err)}${RESET}\n`);
      }

      process.stderr.write("\n");
      rl.prompt();
    });

    rl.on("close", () => {
      resolvePromise(0);
    });

    // Handle Ctrl+C
    rl.on("SIGINT", () => {
      process.stderr.write(`\n\n  ${DIM}Goodbye!${RESET}\n\n`);
      rl.close();
      resolvePromise(0);
    });
  });
}
