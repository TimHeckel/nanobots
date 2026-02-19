import type { Organization } from "@/lib/db/schema";
import type { OrgContext } from "./context";
import { getSystemPrompt, HARDCODED_DEFAULTS } from "@/lib/db/queries/system-prompts";

const ONBOARDING_PREAMBLE = HARDCODED_DEFAULTS["onboarding-preamble"];

const DEFAULT_PERSONALITY = HARDCODED_DEFAULTS["chat-personality"];

export async function buildSystemPrompt(org: Organization, context: OrgContext): Promise<string> {
  const sections: string[] = [];

  // Base personality — read from DB, fall back to hardcoded
  let personality: string;
  try {
    const dbPersonality = await getSystemPrompt(org.id, "chat-personality");
    personality = dbPersonality?.prompt_text ?? DEFAULT_PERSONALITY;
  } catch {
    personality = DEFAULT_PERSONALITY;
  }
  sections.push(personality);

  // Onboarding preamble if not completed
  if (!org.onboarding_completed) {
    try {
      const dbOnboarding = await getSystemPrompt(org.id, "onboarding-preamble");
      sections.push(dbOnboarding?.prompt_text ?? ONBOARDING_PREAMBLE);
    } catch {
      sections.push(ONBOARDING_PREAMBLE);
    }
  }

  // Context
  sections.push(`Org: ${org.name}`);

  if (context.repos.length > 0) {
    sections.push(`Repos: ${context.repos.map((r) => r.full_name).join(", ")}`);
  }

  const activeBots = context.botConfigs.filter((b) => b.enabled);
  const inactiveBots = context.botConfigs.filter((b) => !b.enabled);
  if (activeBots.length > 0) {
    sections.push(`Active bots (${activeBots.length}): ${activeBots.map((b) => b.bot_name).join(", ")}`);
  }
  if (inactiveBots.length > 0) {
    sections.push(`Disabled: ${inactiveBots.map((b) => b.bot_name).join(", ")}`);
  }

  if (context.pendingProposalCount > 0) {
    sections.push(`${context.pendingProposalCount} pending prompt proposals — mention to user.`);
  }

  if (context.swarms && context.swarms.length > 0) {
    const swarmLines = context.swarms.map((s) => `${s.name} (${s.botCount} bots)`);
    sections.push(`Swarms: ${swarmLines.join(", ")}`);
  }

  if (context.webhookCount && context.webhookCount > 0) {
    sections.push(`Webhooks: ${context.webhookCount} active`);
  }

  if (context.recentActivity.length > 0) {
    const lines = context.recentActivity.map((a) => `[${a.event_type}] ${a.summary}`);
    sections.push(`Recent:\n${lines.join("\n")}`);
  }

  // Tool hints — terse
  sections.push(`Tools: createBot, testBot, promoteBot for bot lifecycle. createSwarm, listSwarms, manageSwarm, runSwarm for swarms. configureWebhook, listWebhooks for webhooks. runScan, generateDocs for repo operations.`);

  return sections.join("\n\n");
}
