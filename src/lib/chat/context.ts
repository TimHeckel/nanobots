import { getOrgById } from "@/lib/db/queries/organizations";
import { getReposForOrg } from "@/lib/db/queries/org-repos";
import { getBotConfigs } from "@/lib/db/queries/bot-configs";
import { getPendingProposalCount } from "@/lib/db/queries/prompt-proposals";
import { getRecentActivity } from "@/lib/db/queries/activity-log";
import { listSwarms } from "@/lib/db/queries/swarms";
import { getWebhookEndpoints } from "@/lib/db/queries/webhooks";
import type { Organization, OrgRepo, BotConfig, ActivityLogEntry } from "@/lib/db/schema";

interface SwarmSummary {
  name: string;
  botCount: number;
  bots: string[];
}

export interface OrgContext {
  org: Organization;
  repos: OrgRepo[];
  botConfigs: BotConfig[];
  pendingProposalCount: number;
  recentActivity: ActivityLogEntry[];
  swarms: SwarmSummary[];
  webhookCount: number;
}

export async function getOrgContext(orgId: string): Promise<OrgContext> {
  const [org, repos, botConfigs, pendingProposalCount, recentActivity, swarms, webhookEndpoints] =
    await Promise.all([
      getOrgById(orgId),
      getReposForOrg(orgId),
      getBotConfigs(orgId),
      getPendingProposalCount(orgId),
      getRecentActivity(orgId, 5),
      listSwarms(orgId),
      getWebhookEndpoints(orgId),
    ]);

  if (!org) {
    throw new Error(`Organization not found: ${orgId}`);
  }

  return {
    org,
    repos,
    botConfigs,
    pendingProposalCount,
    recentActivity,
    swarms: swarms.map((s) => ({
      name: s.name,
      botCount: s.bot_count,
      bots: s.bot_names,
    })),
    webhookCount: webhookEndpoints.filter((ep) => ep.active).length,
  };
}
