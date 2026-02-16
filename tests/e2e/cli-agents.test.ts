/**
 * CLI E2E Tests: Bot creation and scanning with free OpenRouter models.
 *
 * These tests hit the real OpenRouter API with free models to verify the
 * full create -> test -> promote -> scan lifecycle works end-to-end.
 *
 * Requires: OPENROUTER_API_KEY env var.
 *
 * Run:
 *   npm run test:agents
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Free model on OpenRouter that supports system prompts and JSON output
const FREE_MODEL = "arcee-ai/trinity-large-preview:free";

const API_KEY = process.env.OPENROUTER_API_KEY ?? "";
const skipIfNoKey = !API_KEY;

// Strip ANSI escape codes so assertions match plain text
const ANSI_RE = /\x1b\[[0-9;]*m/g;
function strip(s: string): string {
  return s.replace(ANSI_RE, "");
}

let tempDir: string;
let createdBotName: string;

function cli(
  args: string,
  cwd?: string,
): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync(
    `npx tsx ${join(process.cwd(), "cli/index.ts")} ${args}`,
    {
      cwd: cwd ?? tempDir,
      encoding: "utf-8",
      timeout: 120_000,
      shell: true,
      env: { ...process.env, OPENROUTER_API_KEY: API_KEY },
    },
  );
  return {
    stdout: strip(result.stdout ?? ""),
    stderr: strip(result.stderr ?? ""),
    exitCode: result.status ?? 1,
  };
}

describe.skipIf(skipIfNoKey)("CLI e2e: bot agents with free models", () => {
  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nanobots-agents-"));

    // Create sample source files with deliberate issues for bots to find
    await mkdir(join(tempDir, "src"), { recursive: true });

    await writeFile(
      join(tempDir, "src/app.ts"),
      `import express from "express";

const app = express();

// TODO: add authentication middleware
// TODO(urgent): fix memory leak in WebSocket handler
// FIXME: race condition in concurrent requests
// HACK: temporary workaround for timezone issues

app.get("/users", (req, res) => {
  const apiKey = "sk-1234567890abcdef";
  console.log("fetching users with key:", apiKey);
  res.json({ users: [] });
});

app.post("/login", (req, res) => {
  // TODO: implement rate limiting
  const password = req.body.password;
  console.log("login attempt:", password);
  res.json({ token: "abc123" });
});

export default app;
`,
      "utf-8",
    );

    await writeFile(
      join(tempDir, "src/utils.ts"),
      `// TODO: refactor this to use a proper logger
export function log(msg: string) {
  console.log(\`[app] \${msg}\`);
}

// FIXME: this doesn't handle edge cases
export function parseDate(input: string): Date {
  return new Date(input);
}

// TODO(low): add JSDoc comments
export function slugify(text: string): string {
  return text.toLowerCase().replace(/\\s+/g, "-");
}

const DB_PASSWORD = "supersecret123";
console.debug("db password loaded");
`,
      "utf-8",
    );

    await writeFile(
      join(tempDir, "src/config.ts"),
      `export const config = {
  port: 3000,
  // TODO: move to environment variables
  dbHost: "localhost",
  dbPassword: "admin123",
  jwtSecret: "my-jwt-secret-key-do-not-share",
  apiEndpoint: "https://api.example.com",
};
`,
      "utf-8",
    );
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("should create a bot from natural language description", async () => {
    const { stderr, exitCode } = cli(
      `create "Find TODO, FIXME, and HACK comments in TypeScript source code and classify them by urgency" --model ${FREE_MODEL}`,
    );

    expect(exitCode).toBe(0);
    expect(stderr).toContain("Bot created!");
    expect(stderr).toContain("draft");

    // Read the bots directory to get the actual file name
    const botsDir = join(tempDir, ".nanobots/bots");
    const files = await readdir(botsDir);
    expect(files.length).toBeGreaterThanOrEqual(1);
    createdBotName = files[0].replace(".json", "");

    // Verify the bot file is valid JSON with required fields
    const content = await readFile(join(botsDir, files[0]), "utf-8");
    const bot = JSON.parse(content);
    expect(bot.name).toBe(createdBotName);
    expect(bot.status).toBe("draft");
    expect(bot.source).toBe("user");
    expect(bot.systemPrompt).toBeTruthy();
    expect(bot.config).toBeDefined();
  });

  it("should list the custom bot with --all flag", () => {
    const { stdout } = cli("list --all");
    expect(stdout).toContain(createdBotName);
    expect(stdout).toContain("(custom)");
  });

  it("should describe the created bot", () => {
    const { stdout } = cli(`describe ${createdBotName}`);
    expect(stdout).toContain(createdBotName);
    expect(stdout).toContain("draft");
    expect(stdout).toContain("user");
    expect(stdout).toContain("System Prompt:");
  });

  it("should test the bot against sample files", async () => {
    const { stderr, exitCode } = cli(
      `test ${createdBotName} . --model ${FREE_MODEL}`,
    );

    expect(exitCode).toBe(0);
    expect(stderr).toContain("Testing");
    expect(stderr).toContain("Test complete");
    expect(stderr).toMatch(/Found \d+ finding/);
  });

  it("should promote the bot from draft to testing", async () => {
    const { stderr, exitCode } = cli(`promote ${createdBotName}`);

    expect(exitCode).toBe(0);
    expect(stderr).toContain("testing");

    const content = await readFile(
      join(tempDir, `.nanobots/bots/${createdBotName}.json`),
      "utf-8",
    );
    const bot = JSON.parse(content);
    expect(bot.status).toBe("testing");
    expect(bot.promotedAt).toBeDefined();
  });

  it("should promote the bot from testing to active", async () => {
    const { stderr, exitCode } = cli(`promote ${createdBotName}`);

    expect(exitCode).toBe(0);
    expect(stderr).toContain("active");

    const content = await readFile(
      join(tempDir, `.nanobots/bots/${createdBotName}.json`),
      "utf-8",
    );
    expect(JSON.parse(content).status).toBe("active");
  });

  it("should scan with the now-active custom bot", () => {
    const { stdout, stderr, exitCode } = cli(
      `scan . --bot ${createdBotName} --model ${FREE_MODEL}`,
    );

    // Exit code 0 = no findings, 1 = findings found (both are valid outcomes)
    expect(exitCode).toBeLessThanOrEqual(1);
    expect(stderr).toContain("Scanning with");
    // Bot name appears in the terminal output (stdout) if findings exist
    if (exitCode === 1) {
      expect(stdout).toContain(createdBotName);
    }
  });

  it("should scan with a built-in bot using the free model", () => {
    const { stdout, stderr, exitCode } = cli(
      `scan . --bot security-scanner --model ${FREE_MODEL}`,
    );

    // Exit code 0 or 1 — both valid (depends on whether the model finds issues)
    expect(exitCode).toBeLessThanOrEqual(1);
    expect(stderr).toContain("Scanning with");
    // Bot name appears in terminal output (stdout) if findings exist
    if (exitCode === 1) {
      expect(stdout).toContain("security-scanner");
    }
  });

  it("should output valid JSON with --json flag", () => {
    const { stdout, exitCode } = cli(
      `scan . --bot ${createdBotName} --model ${FREE_MODEL} --json`,
    );

    expect(exitCode).toBeLessThanOrEqual(1);
    const parsed = JSON.parse(stdout);
    expect(parsed).toHaveProperty("results");
    expect(parsed).toHaveProperty("summary");
    expect(Array.isArray(parsed.results)).toBe(true);
  });
});
