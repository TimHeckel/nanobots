import { Octokit } from "@octokit/rest";

export interface RepoFile {
  path: string;
  content: string;
}

export interface FileChange {
  path: string;
  content: string;
}

export interface NanobotResult {
  /** Human-readable name of the nanobot */
  nanobot: string;
  /** Files to create or update in the fix PR */
  changedFiles: FileChange[];
  /** Files to delete in the fix PR */
  deletedFiles: string[];
  /** PR title (conventional commit format) */
  prTitle: string;
  /** PR body (markdown) */
  prBody: string;
  /** How many issues were found */
  findingCount: number;
  /** Files that were scanned */
  scannedFileCount: number;
}

export interface NanobotContext {
  octokit?: Octokit;
  owner: string;
  repo: string;
  files: RepoFile[];
  /** All file paths in the repo (including non-source files) */
  allPaths: string[];
  /** Per-org system prompt for LLM-enhanced analysis (Tier 2) */
  systemPrompt?: string;
}

/**
 * Every nanobot implements this interface.
 * It receives the repo context and returns a result with fixes to apply.
 * If no issues are found, return null.
 */
export interface Nanobot {
  name: string;
  description: string;
  category: "security" | "docs";
  /** File extensions this nanobot cares about */
  fileExtensions: string[];
  /** Run the analysis and return fixes, or null if nothing to do */
  run(ctx: NanobotContext): Promise<NanobotResult | null>;
}
