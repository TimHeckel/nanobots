import { analyzeWithLLM, isLLMAvailable, LLMFinding } from "./client";
import type { RepoFile } from "../nanobots/types";

const MAX_FILES_PER_BATCH = 5;
const MAX_CONTENT_LENGTH = 50_000; // ~50KB per batch

/**
 * Batch analyze files with LLM using a system prompt.
 * Groups files into batches to stay within context limits.
 */
export async function batchAnalyzeFiles(
  files: RepoFile[],
  systemPrompt: string,
  analysisContext: string
): Promise<LLMFinding[]> {
  if (!isLLMAvailable() || files.length === 0) {
    return [];
  }

  const allFindings: LLMFinding[] = [];

  // Group files into batches
  const batches: RepoFile[][] = [];
  let currentBatch: RepoFile[] = [];
  let currentLength = 0;

  for (const file of files) {
    if (currentBatch.length >= MAX_FILES_PER_BATCH || currentLength + file.content.length > MAX_CONTENT_LENGTH) {
      if (currentBatch.length > 0) batches.push(currentBatch);
      currentBatch = [];
      currentLength = 0;
    }
    currentBatch.push(file);
    currentLength += file.content.length;
  }
  if (currentBatch.length > 0) batches.push(currentBatch);

  // Analyze each batch
  for (const batch of batches) {
    const fileContents = batch
      .map((f) => `--- ${f.path} ---\n${f.content}`)
      .join("\n\n");

    const prompt = `${analysisContext}

Analyze the following files for security issues:

${fileContents}`;

    try {
      const result = await analyzeWithLLM(systemPrompt, prompt, 3000);
      allFindings.push(...result.findings);
    } catch (err) {
      console.error("[analyzer] Batch analysis failed:", err);
    }
  }

  return allFindings;
}
