import type { Organization } from "@/lib/db/schema";
import type { OrgContext } from "./context";
import { getSystemPrompt, HARDCODED_DEFAULTS } from "@/lib/db/queries/system-prompts";

const ONBOARDING_PREAMBLE = HARDCODED_DEFAULTS["onboarding-preamble"];

const DEFAULT_PERSONALITY = HARDCODED_DEFAULTS["chat-personality"];

export async function buildSystemPrompt(org: Organization, context: OrgContext): Promise<string> {
  const sections: string[] = [];

  // Onboarding preamble if not completed
  if (!org.onboarding_completed) {
    const dbOnboarding = await getSystemPrompt(org.id, "onboarding-preamble");
    sections.push(dbOnboarding?.prompt_text ?? ONBOARDING_PREAMBLE);
  }

  // Base personality — read from DB, fall back to hardcoded
  const dbPersonality = await getSystemPrompt(org.id, "chat-personality");
  const personality = dbPersonality?.prompt_text ?? DEFAULT_PERSONALITY;
  sections.push(
    personality.includes(org.name)
      ? personality
      : `${personality}\n\nYou are currently assisting the organization: ${org.name}.`
  );

  // Connected repos
  if (context.repos.length > 0) {
    const repoNames = context.repos.map((r) => r.full_name).join(", ");
    sections.push(`Connected repositories: ${repoNames}`);
  } else {
    sections.push("No repositories are connected yet.");
  }

  // Active bots
  const activeBots = context.botConfigs.filter((b) => b.enabled);
  const inactiveBots = context.botConfigs.filter((b) => !b.enabled);
  if (activeBots.length > 0) {
    sections.push(
      `Active bots (${activeBots.length}/${context.botConfigs.length}): ${activeBots.map((b) => b.bot_name).join(", ")}`
    );
  }
  if (inactiveBots.length > 0) {
    sections.push(
      `Disabled bots: ${inactiveBots.map((b) => b.bot_name).join(", ")}`
    );
  }

  // Pending proposals
  if (context.pendingProposalCount > 0) {
    sections.push(
      `There are ${context.pendingProposalCount} pending prompt update proposal(s) that need review. Proactively mention this to the user.`
    );
  }

  // Bot creation & lifecycle
  sections.push(
    `Bot creation: You can create custom bots through conversation. Guide users through what the bot should scan for, its category, and file types. Use createBot to save, testBot to validate against a real repo, and promoteBot to advance through draft → testing → active.`
  );

  // Swarm management
  sections.push(
    `Swarm management: Swarms are named collections of bots that run together as a group. Use createSwarm to create, listSwarms to view, manageSwarm to add/remove bots or delete, and runSwarm to run a swarm against a repository.`
  );

  // Swarms context
  if (context.swarms && context.swarms.length > 0) {
    const swarmLines = context.swarms.map(
      (s) => `- ${s.name} (${s.botCount} bots): ${s.bots.join(", ")}`
    );
    sections.push(`Configured swarms:\n${swarmLines.join("\n")}`);
  }

  // Webhook configuration
  sections.push(
    `Webhook configuration: You can set up webhook endpoints for external dashboards (Slack, Grafana, custom HTTP). Events: scan.started, scan.completed, bot.started, bot.completed, bot.finding, pr.created. Use configureWebhook to create and listWebhooks to view.`
  );

  if (context.webhookCount && context.webhookCount > 0) {
    sections.push(`Active webhooks: ${context.webhookCount} endpoint(s) configured.`);
  }

  // Recent activity summary
  if (context.recentActivity.length > 0) {
    const activityLines = context.recentActivity.map(
      (a) => `- [${a.event_type}] ${a.summary}`
    );
    sections.push(`Recent activity:\n${activityLines.join("\n")}`);
  }

  return sections.join("\n\n");
}
