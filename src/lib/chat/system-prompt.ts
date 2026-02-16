import type { Organization } from "@/lib/db/schema";
import type { OrgContext } from "./context";

const ONBOARDING_PREAMBLE = `Welcome to nanobots.sh! I'm your AI security assistant and I'm here to help you get started.

Here's what you should know:
- You have 7 security bots that automatically scan your code and open fix PRs:
  1. console-cleanup - Remove console.log/debug statements
  2. unused-imports - Remove imports that aren't referenced
  3. actions-updater - Update deprecated GitHub Actions
  4. secret-scanner - Detect hardcoded secrets and API keys
  5. actions-security - Pin GitHub Actions to SHA digests
  6. dead-exports - Remove exports nothing imports
  7. llm-security - OWASP LLM Top 10 vulnerability detection
- You also have 3 documentation bots that generate living docs from your code:
  8. readme-generator - Generate comprehensive README with install instructions
  9. architecture-mapper - Generate architecture docs with Mermaid diagrams
  10. api-doc-generator - Generate API docs with runnable curl/fetch examples
- You can invite team members to collaborate on security management.
- Ask me to run a scan on any of your connected repositories to see nanobots in action.
- Ask me to generate documentation for any repository — I'll create a PR with README, architecture diagrams, and API docs.
- I can help you enable/disable specific bots, review findings, and manage security proposals.

`;

export function buildSystemPrompt(org: Organization, context: OrgContext): string {
  const sections: string[] = [];

  // Onboarding preamble if not completed
  if (!org.onboarding_completed) {
    sections.push(ONBOARDING_PREAMBLE);
  }

  // Base personality
  sections.push(
    `You are the nanobots.sh AI assistant for ${org.name}. You help manage nanobot configurations, review scan results, handle security proposals, generate documentation, and coordinate team security. Be concise and proactive about surfacing important security information. When users connect a new repository, proactively suggest running a scan and generating documentation.`
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

  // Recent activity summary
  if (context.recentActivity.length > 0) {
    const activityLines = context.recentActivity.map(
      (a) => `- [${a.event_type}] ${a.summary}`
    );
    sections.push(`Recent activity:\n${activityLines.join("\n")}`);
  }

  return sections.join("\n\n");
}
