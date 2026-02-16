import { SeverityBadge } from "@/components/shared/severity-badge";

interface Proposal {
  id: string;
  agent_name: string;
  severity: string;
  threat_source: string;
  created_at: string;
}

interface ProposalListCardProps {
  result: unknown;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function ProposalListCard({ result }: ProposalListCardProps) {
  const data = result as { proposals?: Proposal[] };
  const proposals = data?.proposals ?? (Array.isArray(result) ? (result as Proposal[]) : []);

  if (proposals.length === 0) {
    return (
      <div className="rounded-xl bg-indigo-deep/60 border border-purple-accent/15 p-4 text-foreground/40 text-sm">
        No pending proposals.
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-indigo-deep/60 border border-purple-accent/15 p-4">
      <div className="space-y-2">
        {proposals.map((proposal) => (
          <div
            key={proposal.id}
            className="flex items-center gap-3 rounded-lg bg-background/30 border border-purple-accent/10 px-3 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm text-foreground/70">
                  {proposal.agent_name}
                </span>
                <SeverityBadge severity={proposal.severity} />
              </div>
              <div className="text-xs text-foreground/40 mt-1">
                {proposal.threat_source}
              </div>
            </div>
            <span className="text-xs text-foreground/30 flex-shrink-0">
              {formatDate(proposal.created_at)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
