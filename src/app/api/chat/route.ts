import { streamText, stepCountIs } from "ai";
import { getModel } from "@/lib/llm/provider";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getOrgContext } from "@/lib/chat/context";
import { buildSystemPrompt } from "@/lib/chat/system-prompt";
import {
  listBotsToolDef,
  toggleBotToolDef,
  showActivityToolDef,
  completeOnboardingToolDef,
  runScanToolDef,
  showScanResultsToolDef,
  showStatsToolDef,
  listProposalsToolDef,
  reviewProposalToolDef,
  approveProposalToolDef,
  rejectProposalToolDef,
  editSystemPromptToolDef,
  inviteMemberToolDef,
  generateDocsToolDef,
  docStatusToolDef,
  createBotToolDef,
  testBotToolDef,
  promoteBotToolDef,
  createSwarmToolDef,
  listSwarmsToolDef,
  manageSwarmToolDef,
  runSwarmToolDef,
  configureWebhookToolDef,
  listWebhooksToolDef,
} from "@/lib/chat/tools";

export async function POST(req: NextRequest) {
  const session = await getSession(await cookies());

  if (!session?.userId || !session?.orgId || !session?.role) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { userId, orgId, role } = session;

  const { messages } = await req.json();

  // Build system prompt with org context
  const context = await getOrgContext(orgId);
  const systemPrompt = buildSystemPrompt(context.org, context);

  // Assemble all tools with org/user context via closures
  const tools = {
    listBots: listBotsToolDef(orgId),
    toggleBot: toggleBotToolDef(orgId, userId, role),
    showActivity: showActivityToolDef(orgId),
    completeOnboarding: completeOnboardingToolDef(orgId, userId),
    runScan: runScanToolDef(orgId, userId),
    showScanResults: showScanResultsToolDef(orgId),
    showStats: showStatsToolDef(orgId),
    listProposals: listProposalsToolDef(orgId),
    reviewProposal: reviewProposalToolDef(),
    approveProposal: approveProposalToolDef(orgId, userId, role),
    rejectProposal: rejectProposalToolDef(orgId, userId, role),
    editSystemPrompt: editSystemPromptToolDef(orgId, userId, role),
    inviteMember: inviteMemberToolDef(orgId, userId, role),
    generateDocs: generateDocsToolDef(orgId, userId),
    docStatus: docStatusToolDef(orgId),
    createBot: createBotToolDef(orgId, userId),
    testBot: testBotToolDef(orgId),
    promoteBot: promoteBotToolDef(orgId, userId),
    createSwarm: createSwarmToolDef(orgId, userId),
    listSwarms: listSwarmsToolDef(orgId),
    manageSwarm: manageSwarmToolDef(orgId, userId),
    runSwarm: runSwarmToolDef(orgId, userId),
    configureWebhook: configureWebhookToolDef(orgId, userId),
    listWebhooks: listWebhooksToolDef(orgId),
  };

  const result = streamText({
    model: getModel(),
    system: systemPrompt,
    messages,
    tools,
    stopWhen: stepCountIs(5),
  });

  return result.toTextStreamResponse();
}
