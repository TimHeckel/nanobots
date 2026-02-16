import { BotListCard } from "./tool-cards/bot-list-card";
import { BotToggleCard } from "./tool-cards/bot-toggle-card";
import { ActivityFeedCard } from "./tool-cards/activity-feed-card";
import { ScanResultsCard } from "./tool-cards/scan-results-card";
import { StatsCard } from "./tool-cards/stats-card";
import { ProposalListCard } from "./tool-cards/proposal-list-card";
import { ProposalCard } from "./tool-cards/proposal-card";
import { MemberListCard } from "./tool-cards/member-list-card";
import { DocGenerationCard } from "./tool-cards/doc-generation-card";

interface ToolResultRendererProps {
  toolName: string;
  result: unknown;
}

const CONFIRMATION_TOOLS = new Set([
  "completeOnboarding",
  "approveProposal",
  "rejectProposal",
  "inviteMember",
  "editSystemPrompt",
  "runScan",
  "docStatus",
]);

export function ToolResultRenderer({ toolName, result }: ToolResultRendererProps) {
  // Structured tool cards
  switch (toolName) {
    case "listBots":
      return <BotListCard result={result} />;
    case "toggleBot":
      return <BotToggleCard result={result} />;
    case "showActivity":
      return <ActivityFeedCard result={result} />;
    case "showScanResults":
      return <ScanResultsCard result={result} />;
    case "showStats":
      return <StatsCard result={result} />;
    case "listProposals":
      return <ProposalListCard result={result} />;
    case "reviewProposal":
      return <ProposalCard result={result} />;
    case "listMembers":
      return <MemberListCard result={result} />;
    case "generateDocs":
      return <DocGenerationCard result={result} />;
  }

  // Simple confirmation cards
  if (CONFIRMATION_TOOLS.has(toolName)) {
    const data = result as { message?: string } | null;
    const message =
      (data && typeof data === "object" && "message" in data ? data.message : null) ??
      `${toolName} completed successfully.`;

    return (
      <div className="rounded-xl bg-indigo-deep/60 border border-purple-accent/15 p-4">
        <div className="flex items-center gap-2">
          <span className="text-green-neon">{"\u2713"}</span>
          <span className="text-sm text-foreground/60">{message}</span>
        </div>
      </div>
    );
  }

  // Default: JSON display
  return (
    <div className="rounded-xl bg-indigo-deep/60 border border-purple-accent/15 p-4 overflow-x-auto">
      <div className="text-xs text-foreground/30 font-mono mb-2">{toolName}</div>
      <pre className="font-mono text-xs text-foreground/50 whitespace-pre-wrap break-words">
        {JSON.stringify(result, null, 2)}
      </pre>
    </div>
  );
}
