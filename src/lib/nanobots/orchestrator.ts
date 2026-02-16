import crypto from "crypto";
import { getInstallationOctokit, getRepoTree, getFileContent, createFixPR, appendDashboardLink } from "../github";
import { Nanobot, NanobotContext, RepoFile } from "./types";
import { BUILT_IN_BOTS } from "./ai-bots/defaults";
import { adaptAllToNanobots } from "./ai-bots/adapter";
import type { BotEventCallback } from "./ai-bots/events";
import { withScanId } from "./ai-bots/events";

/** All registered nanobots — data-driven via defaults.ts + adapter */
const ALL_NANOBOTS: Nanobot[] = adaptAllToNanobots(BUILT_IN_BOTS);

/** Source file extensions to fetch content for */
const SOURCE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".mts",
  ".yml", ".yaml",
  ".env", ".json",
]);

const SKIP_DIRS = [
  "node_modules/", "dist/", ".next/", "build/", "coverage/",
  ".git/", "vendor/", "__pycache__/", ".turbo/",
];

const MAX_FILE_SIZE = 100_000; // 100KB

/** Structured result from a scan run */
export interface ScanRunResult {
  prUrls: string[];
  botsRun: string[];
  findings: Array<{ bot: string; findingCount: number; prUrl?: string }>;
  totalFindings: number;
  totalPrs: number;
  durationMs: number;
}

export interface RunOptions {
  /** Only run these bots (by name). If omitted, run all. */
  enabledBots?: string[];
  /** Only run bots in this category. If omitted, run all categories. */
  category?: "security" | "docs";
  /** Org login for dashboard link footer */
  orgLogin?: string;
  /** Per-bot system prompts for LLM-enhanced analysis */
  systemPrompts?: Record<string, string>;
  /** Callback for scan lifecycle events */
  onEvent?: BotEventCallback;
}

/**
 * Run nanobots against a repo and open PRs for any findings.
 * Returns structured results and PR URLs.
 */
export async function runAllNanobots(
  installationId: number,
  owner: string,
  repo: string,
  options?: RunOptions
): Promise<string[]>;
export async function runAllNanobots(
  installationId: number,
  owner: string,
  repo: string,
  options: RunOptions & { structured: true }
): Promise<ScanRunResult>;
export async function runAllNanobots(
  installationId: number,
  owner: string,
  repo: string,
  options?: RunOptions & { structured?: boolean }
): Promise<string[] | ScanRunResult> {
  console.log(`[orchestrator] Starting scan: ${owner}/${repo}`);
  const startTime = Date.now();
  const scanId = crypto.randomUUID();
  const emit = options?.onEvent ? withScanId(scanId, options.onEvent) : undefined;

  const octokit = await getInstallationOctokit(installationId);

  // 1. Get the full file tree
  const tree = await getRepoTree(octokit, owner, repo);
  const allPaths = tree.map((f) => f.path);

  // 2. Filter to source files we need to fetch
  const filesToFetch = tree.filter((f) => {
    if (f.size > MAX_FILE_SIZE) return false;
    if (SKIP_DIRS.some((d) => f.path.includes(d))) return false;
    const ext = "." + f.path.split(".").pop();
    return SOURCE_EXTENSIONS.has(ext);
  });

  console.log(`[orchestrator] Tree has ${tree.length} files, fetching ${filesToFetch.length} source files`);

  // 3. Fetch file contents in parallel batches
  const BATCH_SIZE = 15;
  const files: RepoFile[] = [];

  for (let i = 0; i < filesToFetch.length; i += BATCH_SIZE) {
    const batch = filesToFetch.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (f) => {
        try {
          const { content } = await getFileContent(octokit, owner, repo, f.path);
          return { path: f.path, content };
        } catch {
          return null;
        }
      })
    );
    files.push(...(results.filter(Boolean) as RepoFile[]));
  }

  console.log(`[orchestrator] Fetched ${files.length} files in ${Date.now() - startTime}ms`);

  // 4. Build the context
  const ctx: NanobotContext = { octokit, owner, repo, files, allPaths };

  // 5. Determine which bots to run
  let botsToRun = ALL_NANOBOTS;
  if (options?.category) {
    botsToRun = botsToRun.filter((b) => b.category === options.category);
  }
  if (options?.enabledBots) {
    const enabled = new Set(options.enabledBots);
    botsToRun = botsToRun.filter((b) => enabled.has(b.name));
  }

  // Emit scan.started event
  await emit?.({ type: "scan.started", timestamp: new Date().toISOString(), scanId: "", botCount: botsToRun.length, fileCount: files.length, repo: `${owner}/${repo}` });

  // 6. Run each nanobot
  const prUrls: string[] = [];
  const findings: Array<{ bot: string; findingCount: number; prUrl?: string }> = [];
  const botsRun: string[] = [];

  for (const bot of botsToRun) {
    try {
      console.log(`[orchestrator] Running nanobot: ${bot.name}`);
      botsRun.push(bot.name);

      // Filter files to only those this bot cares about
      const botFiles = files.filter((f) => {
        const ext = "." + f.path.split(".").pop();
        return bot.fileExtensions.includes(ext);
      });

      const botCtx: NanobotContext = {
        ...ctx,
        files: botFiles,
        systemPrompt: options?.systemPrompts?.[bot.name],
        onEvent: emit,
      };
      const result = await bot.run(botCtx);

      if (!result) {
        console.log(`[orchestrator] ${bot.name}: clean — nothing to fix`);
        findings.push({ bot: bot.name, findingCount: 0 });
        continue;
      }

      console.log(`[orchestrator] ${bot.name}: found ${result.findingCount} issues`);

      // Add dashboard link to body
      const body = options?.orgLogin
        ? appendDashboardLink(result.prBody, bot.name, options.orgLogin)
        : result.prBody;

      // Informational bot — create an issue instead of a PR
      if (result.changedFiles.length === 0 && result.findingCount > 0) {
        const { data: issue } = await octokit.issues.create({
          owner,
          repo,
          title: result.prTitle,
          body,
          labels: ["nanobots", bot.name],
        });
        console.log(`[orchestrator] ${bot.name}: issue created → ${issue.html_url}`);
        prUrls.push(issue.html_url);
        findings.push({ bot: bot.name, findingCount: result.findingCount, prUrl: issue.html_url });
        await emit?.({ type: "pr.created", timestamp: new Date().toISOString(), scanId: "", botName: bot.name, prUrl: issue.html_url, repo: `${owner}/${repo}` });
        continue;
      }

      // Create the fix PR
      const timestamp = Date.now().toString(36);
      const { prUrl } = await createFixPR(octokit, owner, repo, {
        branchName: `nanobots/${bot.name}-${timestamp}`,
        title: result.prTitle,
        body,
        files: result.changedFiles,
        deletedFiles: result.deletedFiles,
      });

      console.log(`[orchestrator] ${bot.name}: PR created → ${prUrl}`);
      prUrls.push(prUrl);
      findings.push({ bot: bot.name, findingCount: result.findingCount, prUrl });
      await emit?.({ type: "pr.created", timestamp: new Date().toISOString(), scanId: "", botName: bot.name, prUrl, repo: `${owner}/${repo}` });
    } catch (err) {
      console.error(`[orchestrator] ${bot.name} failed:`, err);
      findings.push({ bot: bot.name, findingCount: 0 });
    }
  }

  const duration = Date.now() - startTime;
  console.log(`[orchestrator] Scan complete: ${owner}/${repo} in ${duration}ms, ${prUrls.length} PRs created`);

  const totalFindings = findings.reduce((sum, f) => sum + f.findingCount, 0);
  await emit?.({ type: "scan.completed", timestamp: new Date().toISOString(), scanId: "", totalFindings, durationMs: duration });

  if (options?.structured) {
    return {
      prUrls,
      botsRun,
      findings,
      totalFindings,
      totalPrs: prUrls.length,
      durationMs: duration,
    };
  }

  return prUrls;
}
