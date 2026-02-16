import { isLLMAvailable } from "../llm/client";
import { batchAnalyzeFiles } from "../llm/analyzer";
import type { NanobotContext, NanobotResult, RepoFile } from "./types";
import type { LLMFinding } from "../llm/client";

/**
 * Two-tier scanning engine.
 * Tier 1: Regex patterns (fast, free, no hallucinations)
 * Tier 2: LLM analysis using per-org system prompt (deep, paid)
 *
 * Usage: Individual bots call runTier1 for regex, then optionally
 * call runTier2 for LLM-enhanced analysis on flagged files.
 */

export interface Tier1Finding {
  file: string;
  line: number;
  pattern: string;
  match: string;
  severity: "critical" | "high" | "medium" | "low";
}

/**
 * Run regex-based scanning (Tier 1).
 * Returns findings and the set of files that had matches (for Tier 2 input).
 */
export function runTier1Scan(
  files: RepoFile[],
  patterns: Array<{ regex: RegExp; name: string; severity: Tier1Finding["severity"] }>
): { findings: Tier1Finding[]; flaggedFiles: RepoFile[] } {
  const findings: Tier1Finding[] = [];
  const flaggedFilePaths = new Set<string>();

  for (const file of files) {
    const lines = file.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      for (const pattern of patterns) {
        const match = lines[i].match(pattern.regex);
        if (match) {
          findings.push({
            file: file.path,
            line: i + 1,
            pattern: pattern.name,
            match: match[0].substring(0, 100), // Truncate for safety
            severity: pattern.severity,
          });
          flaggedFilePaths.add(file.path);
        }
      }
    }
  }

  const flaggedFiles = files.filter((f) => flaggedFilePaths.has(f.path));
  return { findings, flaggedFiles };
}

/**
 * Run LLM-enhanced analysis (Tier 2) on flagged files.
 * Only runs if OPENROUTER_API_KEY is set and a system prompt is provided.
 * Returns additional findings discovered by the LLM.
 */
export async function runTier2Scan(
  flaggedFiles: RepoFile[],
  systemPrompt: string | undefined,
  botName: string
): Promise<LLMFinding[]> {
  if (!isLLMAvailable() || !systemPrompt || flaggedFiles.length === 0) {
    return [];
  }

  console.log(`[scanner] Running Tier 2 LLM analysis for ${botName} on ${flaggedFiles.length} files`);

  return batchAnalyzeFiles(
    flaggedFiles,
    systemPrompt,
    `You are the ${botName} nanobot performing deep analysis. The regex-based Tier 1 scan already flagged these files as potentially having issues. Perform a thorough analysis to find additional issues that regex patterns might miss.`
  );
}

/**
 * Format LLM findings into a markdown section for PR/issue bodies.
 */
export function formatLLMFindings(findings: LLMFinding[]): string {
  if (findings.length === 0) return "";

  const lines = [
    "",
    "### Deep Analysis (LLM-Enhanced)",
    "",
  ];

  for (const finding of findings) {
    const loc = finding.line ? `${finding.file}:${finding.line}` : finding.file;
    lines.push(`- **${finding.severity.toUpperCase()}** \`${loc}\`: ${finding.description}`);
    if (finding.suggestion) {
      lines.push(`  - Suggestion: ${finding.suggestion}`);
    }
  }

  return lines.join("\n");
}
