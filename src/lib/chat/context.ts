import { getOrgById } from "@/lib/db/queries/organizations";
import { getReposForOrg } from "@/lib/db/queries/org-repos";
import { getBotConfigs } from "@/lib/db/queries/bot-configs";
import { getPendingProposalCount } from "@/lib/db/queries/prompt-proposals";
import { getRecentActivity } from "@/lib/db/queries/activity-log";
import type { Organization, OrgRepo, BotConfig, ActivityLogEntry } from "@/lib/db/schema";

export interface OrgContext {
  org: Organization;
  repos: OrgRepo[];
  botConfigs: BotConfig[];
  pendingProposalCount: number;
  recentActivity: ActivityLogEntry[];
}

export async function getOrgContext(orgId: string): Promise<OrgContext> {
  const [org, repos, botConfigs, pendingProposalCount, recentActivity] =
    await Promise.all([
      getOrgById(orgId),
      getReposForOrg(orgId),
      getBotConfigs(orgId),
      getPendingProposalCount(orgId),
      getRecentActivity(orgId, 5),
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
  };
}
