#!/usr/bin/env node

import { parseFlags } from "./flags";
import { VERSION } from "./version";
import { scanCommand } from "./commands/scan";
import { listCommand } from "./commands/list";
import { describeCommand } from "./commands/describe";
import { initCommand } from "./commands/init";
import { authCommand } from "./commands/auth";
import { createCommand } from "./commands/create";
import { testBotCommand } from "./commands/test-bot";
import { promoteCommand } from "./commands/promote";
import { chatCommand } from "./commands/chat";
import { loadConfig } from "./config";
import { defaultProviderConfig } from "./provider";
import { resolve } from "node:path";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const CYAN = "\x1b[36m";

function printUsage(): void {
  process.stdout.write(`
${BOLD}nanobots${RESET} v${VERSION} — AI-native code scanner

${BOLD}Usage:${RESET}
  nanobots scan [dir]              Scan a directory for issues
  nanobots list [--all]            Show available bots
  nanobots describe <bot>          Show bot details
  nanobots create "<description>"  Create a new bot from description
  nanobots test <bot> [dir]        Test a bot against files
  nanobots promote <bot>           Promote bot to next lifecycle stage
  nanobots chat                    Interactive AI assistant
  nanobots init                    Create .nanobots.toml config
  nanobots auth                    Set up OpenRouter API key

${BOLD}Scan Flags:${RESET}
  --bots <category>   Filter by category: security, quality, docs
  --bot <name>        Run a specific bot
  --fix               Write fixes to disk
  --json              Output structured JSON (for CI)
  --model <model>     Override model (e.g. anthropic/claude-sonnet-4.5)
  --verbose           Show detailed output
  --all               Show all bots including draft/testing/archived

${BOLD}Bot Lifecycle:${RESET}
  ${DIM}draft → testing → active → archived${RESET}
  Create a bot, test it, then promote through stages.

${BOLD}Examples:${RESET}
  ${CYAN}nanobots scan .${RESET}                          ${DIM}Scan current directory${RESET}
  ${CYAN}nanobots scan . --bots security${RESET}          ${DIM}Security bots only${RESET}
  ${CYAN}nanobots scan . --json${RESET}                   ${DIM}JSON output for CI${RESET}
  ${CYAN}nanobots create "Find TODO comments"${RESET}     ${DIM}Create a new bot${RESET}
  ${CYAN}nanobots test todo-finder .${RESET}              ${DIM}Test a draft bot${RESET}
  ${CYAN}nanobots promote todo-finder${RESET}             ${DIM}Promote to next stage${RESET}

${BOLD}Environment:${RESET}
  OPENROUTER_API_KEY   Your OpenRouter API key
                       Get one free at ${CYAN}https://openrouter.ai/keys${RESET}

`);
}

async function main(): Promise<void> {
  // Strip node/bun executable and script path
  const rawArgs = process.argv.slice(2);
  const flags = parseFlags(rawArgs);

  if (flags.version) {
    process.stdout.write(`nanobots v${VERSION}\n`);
    process.exit(0);
  }

  if (flags.help || !flags.command) {
    printUsage();
    process.exit(flags.help ? 0 : 1);
  }

  let exitCode = 0;

  switch (flags.command) {
    case "scan":
      exitCode = await scanCommand(flags);
      break;
    case "list":
      exitCode = await listCommand(rawArgs.includes("--all"));
      break;
    case "describe":
      exitCode = await describeCommand(flags.args[0] ?? "");
      break;
    case "create": {
      const targetDir = resolve(flags.args[1] ?? ".");
      const config = await loadConfig(targetDir);
      const provider = {
        ...defaultProviderConfig(),
        apiKey: config.apiKey || process.env.OPENROUTER_API_KEY || "",
        model: flags.model ?? config.model,
      };
      exitCode = await createCommand(flags.args[0] ?? "", provider, targetDir);
      break;
    }
    case "test": {
      const targetDir = resolve(flags.args[1] ?? ".");
      const config = await loadConfig(targetDir);
      const provider = {
        ...defaultProviderConfig(),
        apiKey: config.apiKey || process.env.OPENROUTER_API_KEY || "",
        model: flags.model ?? config.model,
      };
      exitCode = await testBotCommand(flags.args[0] ?? "", targetDir, provider);
      break;
    }
    case "promote":
      exitCode = await promoteCommand(flags.args[0] ?? "", flags.args[1] ?? ".");
      break;
    case "chat":
      exitCode = await chatCommand(flags);
      break;
    case "init":
      exitCode = await initCommand(flags.args[0]);
      break;
    case "auth":
      exitCode = await authCommand();
      break;
    default:
      process.stderr.write(
        `\n  Unknown command: ${flags.command}\n  Run "nanobots --help" for usage.\n\n`,
      );
      exitCode = 1;
  }

  process.exit(exitCode);
}

main().catch((error) => {
  process.stderr.write(`\n  Fatal error: ${error}\n\n`);
  process.exit(1);
});
