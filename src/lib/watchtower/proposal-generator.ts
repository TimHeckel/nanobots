import { generateText } from "ai";
import { getModel, isLLMAvailable } from "@/lib/llm/provider";
import { createProposal } from "../db/queries/prompt-proposals";
import { getSystemPrompt } from "../db/queries/system-prompts";
import { logActivity } from "../db/queries/activity-log";
import type { Advisory } from "./types";

/**
 * Given a threat advisory and an org, determine if a bot's system prompt
 * should be updated to detect the new threat pattern. If yes, generate
 * a proposed prompt update.
 */
export async function generateProposalForAdvisory(
  orgId: string,
  advisory: Advisory,
  affectedBots: string[]
): Promise<void> {
  if (!isLLMAvailable()) {
    console.log("[proposal-generator] No OPENROUTER_API_KEY, skipping proposal generation");
    return;
  }

  for (const botName of affectedBots) {
    try {
      const currentPromptRow = await getSystemPrompt(orgId, botName);
      const currentPrompt = currentPromptRow?.prompt_text ?? "";

      const { text } = await generateText({
        model: getModel(),
        system: `You are a security prompt engineer. You analyze threat advisories and determine if a code scanning bot's system prompt should be updated to detect new patterns.

Respond in JSON format:
{
  "shouldUpdate": boolean,
  "proposedPrompt": "full updated prompt text if shouldUpdate is true",
  "diffSummary": "brief explanation of what changed and why",
  "reason": "why this update helps detect the threat"
}

If the current prompt already covers this threat pattern, set shouldUpdate to false.`,
        prompt: `Advisory:
- Title: ${advisory.title}
- Severity: ${advisory.severity}
- Source: ${advisory.source}
- CVE: ${advisory.cveId ?? "N/A"}
- Affected: ${advisory.affectedPackage}
- Description: ${advisory.description ?? "N/A"}

Current bot prompt for "${botName}":
${currentPrompt}

Should this bot's prompt be updated to better detect patterns related to this advisory?`,
        maxOutputTokens: 2000,
      });

      let parsed: { shouldUpdate: boolean; proposedPrompt?: string; diffSummary?: string; reason?: string };
      try {
        // Extract JSON from response (may be wrapped in markdown code block)
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { shouldUpdate: false };
      } catch {
        console.error(`[proposal-generator] Failed to parse response for ${botName}`);
        continue;
      }

      if (!parsed.shouldUpdate || !parsed.proposedPrompt) {
        console.log(`[proposal-generator] No update needed for ${botName} re: ${advisory.id}`);
        continue;
      }

      await createProposal({
        org_id: orgId,
        agent_name: botName,
        current_prompt: currentPrompt,
        proposed_prompt: parsed.proposedPrompt,
        diff_summary: parsed.diffSummary,
        reason: parsed.reason,
        threat_source: advisory.source,
        advisory_id: advisory.id,
        severity: advisory.severity,
      });

      await logActivity(orgId, "proposal_created", `Prompt update proposed for ${botName} based on ${advisory.source} advisory: ${advisory.title}`, {
        advisory_id: advisory.id,
        bot_name: botName,
        severity: advisory.severity,
      });

      console.log(`[proposal-generator] Created proposal for ${botName} re: ${advisory.id}`);
    } catch (err) {
      console.error(`[proposal-generator] Failed to generate proposal for ${botName}:`, err);
    }
  }
}

/**
 * Determine which bots might be affected by a given advisory.
 */
export function getAffectedBots(advisory: Advisory): string[] {
  const bots: string[] = [];

  // Secret scanner should know about new credential patterns
  if (advisory.title.toLowerCase().includes("credential") ||
      advisory.title.toLowerCase().includes("secret") ||
      advisory.title.toLowerCase().includes("token") ||
      advisory.title.toLowerCase().includes("key leak")) {
    bots.push("secret-scanner");
  }

  // LLM security should know about new prompt injection / LLM attack patterns
  if (advisory.title.toLowerCase().includes("llm") ||
      advisory.title.toLowerCase().includes("prompt injection") ||
      advisory.title.toLowerCase().includes("ai") ||
      advisory.title.toLowerCase().includes("langchain")) {
    bots.push("llm-security");
  }

  // Actions security should know about compromised actions
  if (advisory.title.toLowerCase().includes("github action") ||
      advisory.title.toLowerCase().includes("supply chain") ||
      advisory.title.toLowerCase().includes("ci/cd")) {
    bots.push("actions-security");
  }

  // If nothing specific matched, propose for the most relevant general bot
  if (bots.length === 0 && (advisory.severity === "critical" || advisory.severity === "high")) {
    bots.push("secret-scanner");
  }

  return bots;
}
