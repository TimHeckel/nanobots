import { generateText, type LanguageModel } from "ai";
import type { BotDefinition, BotFinding } from "./types";

export interface ScanFeedback {
  botName: string;
  findings: BotFinding[];
  confirmedTrue: number;
  confirmedFalse: number;
  missedIssues: string[];
  timestamp: number;
}

export interface PromptRevision {
  botName: string;
  currentPrompt: string;
  revisedPrompt: string;
  reasoning: string;
  expectedImprovement: string;
  timestamp: number;
}

interface RefinerState {
  feedbackHistory: ScanFeedback[];
  revisionHistory: PromptRevision[];
  lastResearchTimestamp: number;
}

const REFINER_SYSTEM_PROMPT = `You are an expert prompt engineer specializing in code analysis systems.
Your job is to continuously improve system prompts used by AI-powered code scanning bots.

You will receive:
1. The current system prompt for a bot
2. Historical scan feedback (false positive rates, missed issues)
3. Current security research and best practices

Your goal: Generate an improved system prompt that:
- Reduces false positives based on observed patterns
- Catches previously missed issues
- Incorporates latest security research
- Maintains precision — never trade accuracy for recall
- Stays focused on the bot's specific domain

Respond with JSON:
{
  "revisedPrompt": "the improved system prompt",
  "reasoning": "why these changes improve the prompt",
  "expectedImprovement": "what should get better",
  "changes": ["list of specific changes made"]
}

Respond ONLY with valid JSON.`;

const RESEARCH_PROMPT = `You are a security researcher. Analyze current trends in code vulnerabilities
and suggest improvements to code scanning prompts.

Given the bot's focus area and current prompt, identify:
1. New vulnerability patterns that should be detected
2. Common false positive patterns that should be excluded
3. Best practices from recent security advisories (OWASP, CVE databases)
4. Emerging attack vectors (supply chain, AI/LLM-specific, etc.)

Respond with JSON:
{
  "newPatterns": ["patterns to add detection for"],
  "falsePositivePatterns": ["patterns causing false positives to exclude"],
  "bestPractices": ["relevant best practices to incorporate"],
  "emergingThreats": ["new threats to be aware of"]
}

Respond ONLY with valid JSON.`;

export async function getRefinerPrompt(): Promise<string> {
  try {
    const { getGlobalDefault } = await import("@/lib/db/queries/system-prompts");
    const dbPrompt = await getGlobalDefault("prompt-refiner");
    return dbPrompt?.prompt_text ?? REFINER_SYSTEM_PROMPT;
  } catch {
    return REFINER_SYSTEM_PROMPT;
  }
}

export async function getResearchPrompt(): Promise<string> {
  try {
    const { getGlobalDefault } = await import("@/lib/db/queries/system-prompts");
    const dbPrompt = await getGlobalDefault("security-researcher");
    return dbPrompt?.prompt_text ?? RESEARCH_PROMPT;
  } catch {
    return RESEARCH_PROMPT;
  }
}

export class PromptRefiner {
  private state: RefinerState;
  private model: LanguageModel;
  private running = false;
  private intervalMs: number;

  constructor(model: LanguageModel, intervalMs: number = 3600_000) {
    this.model = model;
    this.intervalMs = intervalMs;
    this.state = {
      feedbackHistory: [],
      revisionHistory: [],
      lastResearchTimestamp: 0,
    };
  }

  recordFeedback(feedback: ScanFeedback): void {
    this.state.feedbackHistory.push(feedback);
    if (this.state.feedbackHistory.length > 100) {
      this.state.feedbackHistory = this.state.feedbackHistory.slice(-100);
    }
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.loop();
  }

  stop(): void {
    this.running = false;
  }

  async runCycle(bots: BotDefinition[]): Promise<PromptRevision[]> {
    const revisions: PromptRevision[] = [];

    for (const bot of bots) {
      try {
        const research = await this.researchBotDomain(bot);
        const botFeedback = this.state.feedbackHistory.filter(
          (f) => f.botName === bot.name,
        );
        const revision = await this.generateRevision(bot, botFeedback, research);

        if (revision) {
          revisions.push(revision);
          this.state.revisionHistory.push(revision);
        }
      } catch (error) {
        process.stderr.write(
          `  [prompt-refiner] Error refining ${bot.name}: ${error}\n`,
        );
      }
    }

    this.state.lastResearchTimestamp = Date.now();
    return revisions;
  }

  getLatestRevision(botName: string): PromptRevision | undefined {
    const revisions = this.state.revisionHistory.filter(
      (r) => r.botName === botName,
    );
    return revisions[revisions.length - 1];
  }

  getRevisionHistory(): PromptRevision[] {
    return [...this.state.revisionHistory];
  }

  private async loop(): Promise<void> {
    while (this.running) {
      try {
        // The loop caller should provide bots externally
        // This is a placeholder — in production, the orchestrator calls runCycle()
      } catch (error) {
        process.stderr.write(
          `  [prompt-refiner] Cycle error: ${error}\n`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, this.intervalMs));
    }
  }

  private async researchBotDomain(
    bot: BotDefinition,
  ): Promise<Record<string, string[]>> {
    try {
      const researchPrompt = await getResearchPrompt();
      const { text } = await generateText({
        model: this.model,
        system: researchPrompt,
        prompt: [
          `Bot: ${bot.name}`,
          `Category: ${bot.category}`,
          `Description: ${bot.description}`,
          `Current system prompt:\n${bot.systemPrompt}`,
          "",
          "Research and suggest improvements for this bot's detection capabilities.",
        ].join("\n"),
      });

      let cleaned = text.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }
      return JSON.parse(cleaned);
    } catch {
      return {};
    }
  }

  private async generateRevision(
    bot: BotDefinition,
    feedback: ScanFeedback[],
    research: Record<string, string[]>,
  ): Promise<PromptRevision | null> {
    const totalFindings = feedback.reduce(
      (sum, f) => sum + f.findings.length, 0,
    );
    const totalFalse = feedback.reduce(
      (sum, f) => sum + f.confirmedFalse, 0,
    );
    const totalMissed = feedback.reduce(
      (sum, f) => sum + f.missedIssues.length, 0,
    );
    const falsePositiveRate =
      totalFindings > 0 ? (totalFalse / totalFindings) * 100 : 0;
    const missedPatterns = feedback
      .flatMap((f) => f.missedIssues)
      .slice(0, 20);

    try {
      const refinerPrompt = await getRefinerPrompt();
      const { text } = await generateText({
        model: this.model,
        system: refinerPrompt,
        prompt: [
          `# Bot: ${bot.name}`,
          `## Current System Prompt`,
          bot.systemPrompt,
          "",
          `## Scan Feedback (${feedback.length} runs)`,
          `- Total findings: ${totalFindings}`,
          `- False positive rate: ${falsePositiveRate.toFixed(1)}%`,
          `- Missed issues: ${totalMissed}`,
          missedPatterns.length > 0
            ? `- Missed patterns:\n${missedPatterns.map((p) => `  - ${p}`).join("\n")}`
            : "",
          "",
          `## Research Findings`,
          JSON.stringify(research, null, 2),
          "",
          "Generate an improved system prompt.",
        ].join("\n"),
      });

      let cleaned = text.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }

      const parsed = JSON.parse(cleaned);
      if (!parsed.revisedPrompt) return null;

      return {
        botName: bot.name,
        currentPrompt: bot.systemPrompt,
        revisedPrompt: parsed.revisedPrompt,
        reasoning: parsed.reasoning ?? "",
        expectedImprovement: parsed.expectedImprovement ?? "",
        timestamp: Date.now(),
      };
    } catch {
      return null;
    }
  }
}
