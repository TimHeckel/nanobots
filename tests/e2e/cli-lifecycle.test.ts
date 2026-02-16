import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

let tempDir: string;

function cli(args: string, cwd?: string): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync(
    `npx tsx ${join(process.cwd(), "cli/index.ts")} ${args}`,
    {
      cwd: cwd ?? tempDir,
      encoding: "utf-8",
      timeout: 30_000,
      shell: true,
      env: { ...process.env, OPENROUTER_API_KEY: "" },
    },
  );
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    exitCode: result.status ?? 1,
  };
}

describe("CLI e2e: bot lifecycle (create/test/promote)", () => {
  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "nanobots-e2e-"));

    // Create a sample .ts file for the test bot to scan
    await mkdir(join(tempDir, "src"), { recursive: true });
    await writeFile(
      join(tempDir, "src/index.ts"),
      `
// TODO: fix this
const apiKey = "sk-1234567890";
console.log("debug info");
export function hello() { return "world"; }
`,
      "utf-8",
    );
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("should require description for create command", () => {
    const { stderr, exitCode } = cli("create");
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Usage:");
  });

  it("should require API key for create command", () => {
    const { stderr, exitCode } = cli('create "Find TODO comments"');
    expect(exitCode).toBe(1);
    expect(stderr).toContain("No API key");
  });

  it("should require bot name for test command", () => {
    const { stderr, exitCode } = cli("test");
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Usage:");
  });

  it("should error when testing non-existent bot", () => {
    const { stderr, exitCode } = cli("test nonexistent-bot .");
    expect(exitCode).toBe(1);
    expect(stderr).toContain("No API key");
  });

  it("should require bot name for promote command", () => {
    const { stderr, exitCode } = cli("promote");
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Usage:");
  });

  it("should error when promoting non-existent bot", () => {
    const { stderr, exitCode } = cli("promote nonexistent-bot");
    expect(exitCode).toBe(1);
    expect(stderr).toContain("not found");
  });

  it("should be able to manually create a bot via local-store and list it", async () => {
    // Manually write a bot JSON to test the listing with custom bots
    const botsDir = join(tempDir, ".nanobots/bots");
    await mkdir(botsDir, { recursive: true });
    await writeFile(
      join(botsDir, "todo-finder.json"),
      JSON.stringify({
        name: "todo-finder",
        description: "Find TODO comments in source code",
        category: "quality",
        systemPrompt: "You find TODO comments.",
        config: { fileExtensions: [".ts", ".tsx", ".js", ".jsx"] },
        status: "draft",
        source: "user",
        createdAt: new Date().toISOString(),
      }),
      "utf-8",
    );

    const { stdout } = cli("list --all", tempDir);
    // Should show both built-in bots AND the custom draft bot
    expect(stdout).toContain("todo-finder");
    expect(stdout).toContain("(custom)");
  });

  it("should describe a custom bot", async () => {
    const { stdout } = cli("describe todo-finder", tempDir);
    expect(stdout).toContain("todo-finder");
    expect(stdout).toContain("draft");
    expect(stdout).toContain("user");
  });

  it("should promote a draft bot to testing", async () => {
    const { stderr, exitCode } = cli("promote todo-finder", tempDir);
    expect(exitCode).toBe(0);
    expect(stderr).toContain("Promoted!");
    expect(stderr).toContain("testing");

    // Verify the file was updated
    const content = await readFile(
      join(tempDir, ".nanobots/bots/todo-finder.json"),
      "utf-8",
    );
    const bot = JSON.parse(content);
    expect(bot.status).toBe("testing");
    expect(bot.promotedAt).toBeDefined();
  });

  it("should promote testing bot to active", async () => {
    const { stderr, exitCode } = cli("promote todo-finder", tempDir);
    expect(exitCode).toBe(0);
    expect(stderr).toContain("active");

    const content = await readFile(
      join(tempDir, ".nanobots/bots/todo-finder.json"),
      "utf-8",
    );
    const bot = JSON.parse(content);
    expect(bot.status).toBe("active");
  });

  it("should not promote an already active bot", async () => {
    const { stderr, exitCode } = cli("promote todo-finder", tempDir);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("Cannot promote");
  });

  it("should list active custom bot without --all flag", () => {
    const { stdout } = cli("list", tempDir);
    expect(stdout).toContain("todo-finder");
  });

  it("should scan with specific bot including custom bot", () => {
    // Without API key, scan should fail with error
    const { stderr, exitCode } = cli("scan . --bot todo-finder", tempDir);
    expect(exitCode).toBe(1);
    expect(stderr).toContain("No API key");
  });
});
