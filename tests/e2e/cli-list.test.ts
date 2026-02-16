import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";

function cli(args: string): string {
  return execSync(`npx tsx cli/index.ts ${args}`, {
    cwd: process.cwd(),
    encoding: "utf-8",
    timeout: 30_000,
    env: { ...process.env, OPENROUTER_API_KEY: "" },
  });
}

function cliAll(args: string): { stdout: string; stderr: string } {
  try {
    const stdout = execSync(`npx tsx cli/index.ts ${args}`, {
      cwd: process.cwd(),
      encoding: "utf-8",
      timeout: 30_000,
      env: { ...process.env, OPENROUTER_API_KEY: "" },
    });
    return { stdout, stderr: "" };
  } catch (err: any) {
    return {
      stdout: err.stdout?.toString() ?? "",
      stderr: err.stderr?.toString() ?? "",
    };
  }
}

describe("CLI e2e: list command", () => {
  it("should list all 6 built-in active bots", () => {
    const output = cli("list");
    expect(output).toContain("security-scanner");
    expect(output).toContain("code-quality");
    expect(output).toContain("actions-hardening");
    expect(output).toContain("readme-generator");
    expect(output).toContain("architecture-mapper");
    expect(output).toContain("api-doc-generator");
  });

  it("should show category groups", () => {
    const output = cli("list");
    expect(output).toContain("security");
    expect(output).toContain("quality");
    expect(output).toContain("docs");
  });

  it("should support --all flag", () => {
    const output = cli("list --all");
    expect(output).toContain("all statuses");
  });
});

describe("CLI e2e: describe command", () => {
  it("should show bot details", () => {
    const output = cli("describe security-scanner");
    expect(output).toContain("security-scanner");
    expect(output).toContain("Category:");
    expect(output).toContain("Status:");
    expect(output).toContain("active");
    expect(output).toContain("Extensions:");
    expect(output).toContain("System Prompt:");
    expect(output).toContain("OWASP");
  });

  it("should show source for built-in bots", () => {
    const output = cli("describe code-quality");
    expect(output).toContain("Source:");
    expect(output).toContain("built-in");
  });

  it("should error on unknown bot", () => {
    const { stderr } = cliAll("describe nonexistent-bot");
    expect(stderr).toContain("Unknown bot");
  });

  it("should show usage when no bot specified", () => {
    const { stderr } = cliAll("describe");
    expect(stderr).toContain("Usage:");
  });
});

describe("CLI e2e: help", () => {
  it("should show all commands including new ones", () => {
    const { stdout } = cliAll("--help");
    expect(stdout).toContain("scan");
    expect(stdout).toContain("list");
    expect(stdout).toContain("describe");
    expect(stdout).toContain("create");
    expect(stdout).toContain("test");
    expect(stdout).toContain("promote");
    expect(stdout).toContain("init");
    expect(stdout).toContain("auth");
  });

  it("should show bot lifecycle info", () => {
    const { stdout } = cliAll("--help");
    expect(stdout).toContain("Bot Lifecycle");
    expect(stdout).toContain("draft");
    expect(stdout).toContain("testing");
    expect(stdout).toContain("active");
    expect(stdout).toContain("archived");
  });
});

describe("CLI e2e: version", () => {
  it("should show version number", () => {
    const output = cli("--version");
    expect(output).toMatch(/nanobots v\d+\.\d+\.\d+/);
  });
});

describe("CLI e2e: unknown command", () => {
  it("should error on unknown command", () => {
    const { stderr } = cliAll("foobar");
    expect(stderr).toContain("Unknown command");
  });
});
