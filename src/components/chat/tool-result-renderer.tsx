import { BotListCard } from "./tool-cards/bot-list-card";
import { BotToggleCard } from "./tool-cards/bot-toggle-card";
import { ActivityFeedCard } from "./tool-cards/activity-feed-card";
import { ScanResultsCard } from "./tool-cards/scan-results-card";
import { StatsCard } from "./tool-cards/stats-card";
import { ProposalListCard } from "./tool-cards/proposal-list-card";
import { ProposalCard } from "./tool-cards/proposal-card";
import { MemberListCard } from "./tool-cards/member-list-card";
import { DocGenerationCard } from "./tool-cards/doc-generation-card";
import { SwarmListCard } from "./tool-cards/swarm-list-card";
import { SwarmCard } from "./tool-cards/swarm-card";
import { WebhookListCard } from "./tool-cards/webhook-list-card";

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
  "createBot",
  "promoteBot",
  "manageSwarm",
  "configureWebhook",
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
    case "listSwarms":
      return <SwarmListCard result={result} />;
    case "createSwarm":
      return <SwarmCard result={result} />;
    case "listWebhooks":
      return <WebhookListCard result={result} />;
    case "runSwarm":
      return <ScanResultsCard result={result} />;
    case "testBot": {
      const data = result as { findingCount?: number; findings?: Array<{ severity?: string; file?: string; description?: string }>; message?: string };
      return (
        <div className="rounded-xl bg-indigo-deep/60 border border-purple-accent/15 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-foreground/70">
              {data?.findingCount ?? 0} finding{(data?.findingCount ?? 0) !== 1 ? "s" : ""}
            </span>
          </div>
          {data?.findings && data.findings.length > 0 && (
            <div className="space-y-1.5">
              {data.findings.map((f, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className={`font-mono uppercase flex-shrink-0 ${
                    f.severity === "critical" || f.severity === "high" ? "text-red-400" :
                    f.severity === "medium" ? "text-amber-warn" : "text-foreground/40"
                  }`}>
                    {f.severity ?? "info"}
                  </span>
                  <span className="text-foreground/50">
                    {f.file && <span className="text-green-neon">{f.file}</span>}
                    {f.description && <span className="ml-1">{f.description}</span>}
                  </span>
                </div>
              ))}
            </div>
          )}
          {data?.message && (
            <div className="text-sm text-foreground/60">{data.message}</div>
          )}
        </div>
      );
    }
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
