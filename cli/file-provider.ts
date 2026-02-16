import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative, extname } from "node:path";
import type { RepoFile } from "./bots/types";

const DEFAULT_IGNORE = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "coverage",
  ".turbo",
  ".vercel",
  "__pycache__",
  ".venv",
  "vendor",
]);

const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".webp",
  ".woff", ".woff2", ".ttf", ".eot",
  ".zip", ".tar", ".gz", ".br",
  ".pdf", ".doc", ".docx",
  ".mp3", ".mp4", ".wav", ".avi",
  ".exe", ".dll", ".so", ".dylib",
  ".wasm",
]);

const MAX_FILE_SIZE = 100 * 1024; // 100KB per file

export interface WalkOptions {
  extensions?: string[];
  ignorePaths?: string[];
}

function matchesGlob(path: string, pattern: string): boolean {
  // Simple glob matching: supports trailing / (directory), leading * (extension)
  if (pattern.endsWith("/")) {
    return path.startsWith(pattern) || path.includes(`/${pattern}`);
  }
  if (pattern.startsWith("*.")) {
    return path.endsWith(pattern.slice(1));
  }
  return path === pattern || path.endsWith(`/${pattern}`);
}

async function loadGitignore(dir: string): Promise<string[]> {
  try {
    const content = await readFile(join(dir, ".gitignore"), "utf-8");
    return content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));
  } catch {
    return [];
  }
}

export async function walkFiles(
  rootDir: string,
  options: WalkOptions = {},
): Promise<{ files: RepoFile[]; allPaths: string[] }> {
  const gitignorePatterns = await loadGitignore(rootDir);
  const extraIgnore = options.ignorePaths ?? [];
  const allIgnorePatterns = [...gitignorePatterns, ...extraIgnore];

  const files: RepoFile[] = [];
  const allPaths: string[] = [];

  const extensionFilter = options.extensions
    ? new Set(options.extensions)
    : null;

  async function walk(dir: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relPath = relative(rootDir, fullPath);

      // Skip default ignored directories
      if (entry.isDirectory() && DEFAULT_IGNORE.has(entry.name)) continue;

      // Skip custom ignored patterns
      if (allIgnorePatterns.some((p) => matchesGlob(relPath, p))) continue;

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        allPaths.push(relPath);

        const ext = extname(entry.name).toLowerCase();

        // Skip binary files
        if (BINARY_EXTENSIONS.has(ext)) continue;

        // Apply extension filter if provided
        if (extensionFilter && !extensionFilter.has(ext)) continue;

        // Check file size
        try {
          const fileStat = await stat(fullPath);
          if (fileStat.size > MAX_FILE_SIZE) continue;
          if (fileStat.size === 0) continue;
        } catch {
          continue;
        }

        try {
          const content = await readFile(fullPath, "utf-8");
          files.push({ path: relPath, content });
        } catch {
          // Skip unreadable files
        }
      }
    }
  }

  await walk(rootDir);

  return { files, allPaths };
}
