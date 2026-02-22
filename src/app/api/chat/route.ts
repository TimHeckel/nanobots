import { streamText, stepCountIs, convertToModelMessages } from "ai";
import { getModel } from "@/lib/llm/provider";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getOrgContext } from "@/lib/chat/context";
import { buildSystemPrompt } from "@/lib/chat/system-prompt";
import { saveMessage } from "@/lib/db/queries/chat-messages";
import {
  getConversation,
  updateConversationTitle,
  touchConversation,
} from "@/lib/db/queries/conversations";
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

export const maxDuration = 60;

function trimToWordBoundary(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const trimmed = text.slice(0, maxLen);
  const lastSpace = trimmed.lastIndexOf(" ");
  return lastSpace > 20 ? trimmed.slice(0, lastSpace) : trimmed;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession(await cookies());

    if (!session?.userId || !session?.orgId || !session?.role) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { userId, orgId, role } = session;

    const { messages: rawMessages, conversationId } = await req.json();

    // useChat() sends UIMessage format (with `parts`), but streamText() expects
    // ModelMessage format (with `content`). Detect and convert when needed.
    let messages;
    try {
      const isUIFormat = rawMessages?.[0]?.parts !== undefined;
      messages = isUIFormat
        ? await convertToModelMessages(rawMessages)
        : rawMessages;
      console.log(`[chat/route] converted ${rawMessages.length} messages (ui=${rawMessages?.[0]?.parts !== undefined})`);
    } catch (convError) {
      console.error("[chat/route] Message conversion failed:", convError);
      return new Response(JSON.stringify({ error: "Message conversion failed" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Save the latest user message to DB if we have a conversation
    if (conversationId) {
      const lastMsg = rawMessages[rawMessages.length - 1];
      if (lastMsg?.role === "user") {
        const textContent =
          lastMsg.content ??
          lastMsg.parts?.find((p: { type: string }) => p.type === "text")?.text ??
          "";
        await saveMessage(orgId, userId, "user", textContent, undefined, conversationId);

        // Auto-title: update if still "New Chat"
        try {
          const conv = await getConversation(conversationId);
          if (conv && conv.title === "New Chat" && textContent) {
            const title = trimToWordBoundary(textContent, 80);
            await updateConversationTitle(conversationId, title);
          }
        } catch {
          // Non-critical — don't block the stream
        }
      }
    }

    // Build system prompt with org context
    const context = await getOrgContext(orgId);
    const systemPrompt = await buildSystemPrompt(context.org, context);

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

    console.log(`[chat/route] streaming for org=${orgId}, conv=${conversationId ?? "none"}, messages=${messages.length}`);

    const result = streamText({
      model: getModel(),
      system: systemPrompt,
      messages,
      tools,
      stopWhen: stepCountIs(5),
      onError: ({ error }) => {
        console.error("[chat/route] Stream error:", error);
      },
      async onFinish({ text }) {
        // Save assistant response to DB
        if (conversationId && text) {
          try {
            await saveMessage(orgId, userId, "assistant", text, undefined, conversationId);
            await touchConversation(conversationId);
          } catch (e) {
            console.error("[chat/route] Failed to save assistant message:", e);
          }
        }
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("[chat/route] Error:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
