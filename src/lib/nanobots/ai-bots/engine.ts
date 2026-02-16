import { generateText, stepCountIs, type LanguageModel } from "ai";
import { instantiateTool } from "./tool-library";
import type { BotDefinition, BotFinding } from "./types";

export interface RepoFile {
  path: string;
  content: string;
}

const MAX_BATCH_BYTES = 50 * 1024;

function filterByExtensions(files: RepoFile[], extensions?: string[]): RepoFile[] {
  if (!extensions || extensions.length === 0) return files;
  const extSet = new Set(extensions);
  return files.filter((f) => {
    const dot = f.path.lastIndexOf(".");
    if (dot === -1) return false;
    return extSet.has(f.path.slice(dot).toLowerCase());
  });
}

function batchFiles(files: RepoFile[], maxPerBatch: number): RepoFile[][] {
  const batches: RepoFile[][] = [];
  let currentBatch: RepoFile[] = [];
  let currentBytes = 0;

  for (const file of files) {
    const fileBytes = new TextEncoder().encode(file.content).length;

    if (
      currentBatch.length >= maxPerBatch ||
      (currentBytes + fileBytes > MAX_BATCH_BYTES && currentBatch.length > 0)
    ) {
      batches.push(currentBatch);
      currentBatch = [];
      currentBytes = 0;
    }

    currentBatch.push(file);
    currentBytes += fileBytes;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

function buildUserPrompt(bot: BotDefinition, files: RepoFile[]): string {
  const parts = [`Analyze the following files:\n`];

  for (const file of files) {
    parts.push(`--- ${file.path} ---`);
    parts.push(file.content);
    parts.push("");
  }

  parts.push(`\nRespond with JSON:
{
  "findings": [
    {
      "file": "path/to/file",
      "line": 42,
      "severity": "critical|high|medium|low|info",
      "category": "category-name",
      "description": "What the issue is",
      "suggestion": "How to fix it",
      "fixedContent": "full corrected file content (if applicable)"
    }
  ]
}

If no issues found, return: { "findings": [] }
Respond ONLY with valid JSON. No markdown fences, no explanation outside the JSON.`);

  return parts.join("\n");
}

function parseFindings(text: string): BotFinding[] {
  try {
    let cleaned = text.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(cleaned);
    const findings: BotFinding[] = [];

    if (Array.isArray(parsed.findings)) {
      for (const f of parsed.findings) {
        const validSeverities = ["critical", "high", "medium", "low", "info"];
        const severity = validSeverities.includes(String(f.severity))
          ? (String(f.severity) as BotFinding["severity"])
          : "medium";

        findings.push({
          file: String(f.file ?? ""),
          line: typeof f.line === "number" ? f.line : undefined,
          severity,
          category: String(f.category ?? "general"),
          description: String(f.description ?? ""),
          suggestion: f.suggestion ? String(f.suggestion) : undefined,
          fixedContent: f.fixedContent ? String(f.fixedContent) : undefined,
        });
      }
    }

    return findings;
  } catch {
    return [];
  }
}

export async function executeBot(
  bot: BotDefinition,
  files: RepoFile[],
  model: LanguageModel,
): Promise<BotFinding[]> {
  const filtered = filterByExtensions(files, bot.config.fileExtensions);

  if (filtered.length === 0) return [];

  // Instantiate bot's tools as AI SDK tool objects
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: Record<string, any> = {};
  for (const def of bot.tools ?? []) {
    tools[def.name] = instantiateTool(def);
  }

  const batches = batchFiles(filtered, bot.config.maxFilesPerBatch ?? 15);
  const allFindings: BotFinding[] = [];

  for (const batch of batches) {
    try {
      const hasTools = Object.keys(tools).length > 0;
      const { text } = await generateText({
        model,
        system: bot.systemPrompt,
        prompt: buildUserPrompt(bot, batch),
        tools: hasTools ? tools : undefined,
        stopWhen: hasTools
          ? stepCountIs(bot.config.maxSteps ?? 5)
          : undefined,
      });

      allFindings.push(...parseFindings(text));
    } catch (error) {
      process.stderr.write(
        `  [${bot.name}] batch error: ${error}\n`,
      );
    }
  }

  return allFindings;
}
