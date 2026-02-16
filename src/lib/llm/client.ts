import { generateText } from "ai";
import { getModel, isLLMAvailable as checkLLM } from "./provider";

export interface LLMAnalysisResult {
  findings: LLMFinding[];
}

export interface LLMFinding {
  file: string;
  line?: number;
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  suggestion?: string;
}

/**
 * Check if LLM analysis is available (OPENROUTER_API_KEY is set).
 */
export function isLLMAvailable(): boolean {
  return checkLLM();
}

/**
 * Analyze code with Claude using a system prompt.
 * Returns structured findings.
 */
export async function analyzeWithLLM(
  systemPrompt: string,
  userPrompt: string,
  maxOutputTokens: number = 2000
): Promise<LLMAnalysisResult> {
  if (!isLLMAvailable()) {
    return { findings: [] };
  }

  const { text } = await generateText({
    model: getModel(),
    system: `${systemPrompt}

IMPORTANT: Respond ONLY with a JSON object in this exact format:
{
  "findings": [
    {
      "file": "path/to/file.ts",
      "line": 42,
      "severity": "high",
      "description": "Brief description of the issue",
      "suggestion": "How to fix it"
    }
  ]
}

If no issues are found, return: {"findings": []}`,
    prompt: userPrompt,
    maxOutputTokens,
  });

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { findings: [] };
    const parsed = JSON.parse(jsonMatch[0]);
    return { findings: Array.isArray(parsed.findings) ? parsed.findings : [] };
  } catch {
    console.error("[llm-client] Failed to parse LLM response");
    return { findings: [] };
  }
}
