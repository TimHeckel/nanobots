import { Octokit } from "@octokit/rest";
import { ParsedCommand } from "./commands";
import { getRepoTree, getFileContent } from "../github";

const FOOTER = "\n\n---\n*[nanobots.sh](https://nanobots.sh) — directed response agent*";

const SOURCE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".mts",
]);

const SKIP_DIRS = [
  "node_modules/", "dist/", ".next/", "build/", "coverage/",
  ".git/", "vendor/", "__pycache__/", ".turbo/",
];

function shouldSkip(path: string): boolean {
  return SKIP_DIRS.some((d) => path.includes(d));
}

function isSourceFile(path: string): boolean {
  const ext = "." + path.split(".").pop();
  return SOURCE_EXTENSIONS.has(ext);
}

async function postComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  body: string
): Promise<void> {
  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: issueNumber,
    body,
  });
}

// --- Scan patterns ---

interface ScanFinding {
  file: string;
  line: number;
  issue: string;
  snippet: string;
}

const SCAN_PATTERNS: Array<{ pattern: RegExp; issue: string }> = [
  { pattern: /console\.(log|debug|info)\(/, issue: "console.log statement" },
  { pattern: /\/\/\s*TODO\b/i, issue: "TODO comment" },
  { pattern: /\/\/\s*FIXME\b/i, issue: "FIXME comment" },
  { pattern: /\/\/\s*HACK\b/i, issue: "HACK comment" },
  { pattern: /(?:password|secret|token|api_key)\s*=\s*["'][^"']{8,}["']/, issue: "potential hardcoded secret" },
  { pattern: /debugger\b/, issue: "debugger statement" },
];

function scanContent(filename: string, content: string): ScanFinding[] {
  const findings: ScanFinding[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    for (const { pattern, issue } of SCAN_PATTERNS) {
      if (pattern.test(lines[i])) {
        findings.push({
          file: filename,
          line: i + 1,
          issue,
          snippet: lines[i].trim().substring(0, 120),
        });
      }
    }
  }

  return findings;
}

// --- Command handlers ---

async function handleScan(params: {
  octokit: Octokit;
  owner: string;
  repo: string;
  issueNumber: number;
  isPullRequest: boolean;
}): Promise<void> {
  const { octokit, owner, repo, issueNumber, isPullRequest } = params;

  const findings: ScanFinding[] = [];

  if (isPullRequest) {
    // Fetch PR changed files
    const { data: prFiles } = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: issueNumber,
      per_page: 100,
    });

    for (const file of prFiles) {
      if (!isSourceFile(file.filename) || file.status === "removed") continue;

      try {
        const { content } = await getFileContent(octokit, owner, repo, file.filename);
        findings.push(...scanContent(file.filename, content));
      } catch {
        // File may have been deleted or inaccessible
      }
    }
  } else {
    // For issues (not PRs), scan the full repo
    const tree = await getRepoTree(octokit, owner, repo);
    const sourceFiles = tree.filter(
      (f) => isSourceFile(f.path) && !shouldSkip(f.path) && f.size < 100_000
    );

    // Limit to 50 files for issue scans
    for (const file of sourceFiles.slice(0, 50)) {
      try {
        const { content } = await getFileContent(octokit, owner, repo, file.path);
        findings.push(...scanContent(file.path, content));
      } catch {
        // Skip inaccessible files
      }
    }
  }

  let body: string;

  if (findings.length === 0) {
    body = `## :robot: nanobots scan\n\nNo issues found. Everything looks clean!${FOOTER}`;
  } else {
    const limited = findings.slice(0, 50);
    const rows = limited.map(
      (f) => `| \`${f.file}\` | ${f.line} | ${f.issue} | \`${f.snippet}\` |`
    );

    body = [
      "## :robot: nanobots scan",
      "",
      `Found **${findings.length}** issue${findings.length === 1 ? "" : "s"}${findings.length > 50 ? " (showing first 50)" : ""}:`,
      "",
      "| File | Line | Issue | Snippet |",
      "|------|------|-------|---------|",
      ...rows,
      FOOTER,
    ].join("\n");
  }

  await postComment(octokit, owner, repo, issueNumber, body);
  console.log(`[agent] scan: posted ${findings.length} findings on ${owner}/${repo}#${issueNumber}`);
}

async function handleFind(params: {
  octokit: Octokit;
  owner: string;
  repo: string;
  issueNumber: number;
  pattern: string;
}): Promise<void> {
  const { octokit, owner, repo, issueNumber, pattern } = params;

  const tree = await getRepoTree(octokit, owner, repo);
  const sourceFiles = tree.filter(
    (f) => isSourceFile(f.path) && !shouldSkip(f.path) && f.size < 100_000
  );

  const matches: Array<{ file: string; line: number; snippet: string }> = [];
  const MAX_MATCHES = 20;

  for (const file of sourceFiles) {
    if (matches.length >= MAX_MATCHES) break;

    try {
      const { content } = await getFileContent(octokit, owner, repo, file.path);
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(pattern)) {
          matches.push({
            file: file.path,
            line: i + 1,
            snippet: lines[i].trim().substring(0, 120),
          });
          if (matches.length >= MAX_MATCHES) break;
        }
      }
    } catch {
      // Skip inaccessible files
    }
  }

  let body: string;

  if (matches.length === 0) {
    body = `## :robot: nanobots find\n\nNo matches found for \`${pattern}\`.${FOOTER}`;
  } else {
    const rows = matches.map(
      (m) => `| \`${m.file}\` | ${m.line} | \`${m.snippet}\` |`
    );

    body = [
      "## :robot: nanobots find",
      "",
      `Found **${matches.length}** match${matches.length === 1 ? "" : "es"} for \`${pattern}\`${matches.length >= MAX_MATCHES ? " (limit reached)" : ""}:`,
      "",
      "| File | Line | Snippet |",
      "|------|------|---------|",
      ...rows,
      FOOTER,
    ].join("\n");
  }

  await postComment(octokit, owner, repo, issueNumber, body);
  console.log(`[agent] find: posted ${matches.length} matches for "${pattern}" on ${owner}/${repo}#${issueNumber}`);
}

async function handleHelp(params: {
  octokit: Octokit;
  owner: string;
  repo: string;
  issueNumber: number;
}): Promise<void> {
  const body = [
    "## :robot: nanobots commands",
    "",
    "| Command | Description |",
    "|---------|-------------|",
    "| `@nanobots scan` | Scan this PR for code quality issues |",
    "| `@nanobots find <pattern>` | Search the codebase for a pattern |",
    "| `@nanobots help` | Show this help message |",
    FOOTER,
  ].join("\n");

  await postComment(params.octokit, params.owner, params.repo, params.issueNumber, body);
  console.log(`[agent] help: posted on ${params.owner}/${params.repo}#${params.issueNumber}`);
}

async function handleUnknown(params: {
  octokit: Octokit;
  owner: string;
  repo: string;
  issueNumber: number;
}): Promise<void> {
  const body = `## :robot: nanobots\n\nI didn't understand that command. Try \`@nanobots help\` to see available commands.${FOOTER}`;

  await postComment(params.octokit, params.owner, params.repo, params.issueNumber, body);
  console.log(`[agent] unknown command on ${params.owner}/${params.repo}#${params.issueNumber}`);
}

// --- Main entry point ---

export async function handleCommand(params: {
  command: ParsedCommand;
  octokit: Octokit;
  owner: string;
  repo: string;
  issueNumber: number;
  isPullRequest: boolean;
}): Promise<void> {
  const { command, octokit, owner, repo, issueNumber, isPullRequest } = params;

  console.log(`[agent] handling "${command.type}" command on ${owner}/${repo}#${issueNumber}`);

  switch (command.type) {
    case "scan":
      return handleScan({ octokit, owner, repo, issueNumber, isPullRequest });
    case "find":
      return handleFind({ octokit, owner, repo, issueNumber, pattern: command.args });
    case "help":
      return handleHelp({ octokit, owner, repo, issueNumber });
    case "unknown":
      return handleUnknown({ octokit, owner, repo, issueNumber });
  }
}
