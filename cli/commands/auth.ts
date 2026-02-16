import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const GREEN = "\x1b[32m";
const CYAN = "\x1b[36m";
const DIM = "\x1b[2m";

function prompt(question: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stderr,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function authCommand(): Promise<number> {
  process.stderr.write(`\n${BOLD}Nanobots Authentication Setup${RESET}\n\n`);
  process.stderr.write(
    `  ${CYAN}1.${RESET} Get your API key at ${BOLD}https://openrouter.ai/keys${RESET}\n`,
  );
  process.stderr.write(
    `  ${CYAN}2.${RESET} Free models available — no credit card needed\n\n`,
  );

  const apiKey = await prompt(`  Enter your OpenRouter API key: `);

  if (!apiKey) {
    process.stderr.write(`\n  No key provided. Aborting.\n\n`);
    return 1;
  }

  // Validate the key with a quick test call
  process.stderr.write(`\n  ${DIM}Validating key...${RESET}`);

  try {
    const response = await fetch(
      "https://openrouter.ai/api/v1/auth/key",
      {
        headers: { Authorization: `Bearer ${apiKey}` },
      },
    );

    if (!response.ok) {
      process.stderr.write(
        `\n  ${BOLD}Invalid API key.${RESET} Check your key at https://openrouter.ai/keys\n\n`,
      );
      return 1;
    }
  } catch {
    process.stderr.write(
      `\n  ${DIM}Could not validate key (network error). Saving anyway.${RESET}\n`,
    );
  }

  // Save to .nanobots.toml
  const configPath = join(".", ".nanobots.toml");

  try {
    const existing = await readFile(configPath, "utf-8");
    // Replace api_key line
    if (existing.includes("api_key")) {
      const updated = existing.replace(
        /api_key\s*=\s*"[^"]*"/,
        `api_key = "${apiKey}"`,
      );
      await writeFile(configPath, updated);
    } else {
      await writeFile(configPath, existing + `\napi_key = "${apiKey}"\n`);
    }
  } catch {
    // No config file — create one
    await writeFile(
      configPath,
      `provider = "openrouter"\nmodel = "meta-llama/llama-4-maverick"\napi_key = "${apiKey}"\n`,
    );
  }

  process.stderr.write(
    `\r  ${GREEN}Key saved to .nanobots.toml${RESET}              \n`,
  );
  process.stderr.write(
    `\n  ${DIM}Tip: Add .nanobots.toml to .gitignore to avoid committing your key${RESET}\n`,
  );
  process.stderr.write(
    `  ${DIM}Or use OPENROUTER_API_KEY env var instead${RESET}\n\n`,
  );

  return 0;
}
