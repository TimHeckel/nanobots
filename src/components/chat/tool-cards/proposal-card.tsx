import { SeverityBadge } from "@/components/shared/severity-badge";
import { DiffViewer } from "@/components/shared/diff-viewer";

interface ProposalData {
  agent_name?: string;
  severity?: string;
  threat_source?: string;
  advisory_id?: string;
  current_prompt?: string;
  proposed_prompt?: string;
  diff_summary?: string;
  reason?: string;
}

interface ProposalCardProps {
  result: unknown;
}

export function ProposalCard({ result }: ProposalCardProps) {
  const data = result as ProposalData;

  return (
    <div className="rounded-xl bg-indigo-deep/60 border border-purple-accent/15 p-4 space-y-4">
      {/* Header info */}
      <div className="flex items-center gap-3 flex-wrap">
        {data?.agent_name && (
          <span className="font-mono text-sm text-green-neon">
            {data.agent_name}
          </span>
        )}
        {data?.severity && <SeverityBadge severity={data.severity} />}
      </div>

      {/* Metadata */}
      <div className="flex items-center gap-4 flex-wrap text-xs text-foreground/40">
        {data?.threat_source && (
          <span>
            Source: <span className="text-foreground/60">{data.threat_source}</span>
          </span>
        )}
        {data?.advisory_id && (
          <span>
            Advisory: <span className="font-mono text-foreground/60">{data.advisory_id}</span>
          </span>
        )}
      </div>

      {/* Reason */}
      {data?.reason && (
        <div className="text-sm text-foreground/60 leading-relaxed">
          {data.reason}
        </div>
      )}

      {/* Diff summary */}
      {data?.diff_summary && (
        <div className="text-xs text-foreground/40 font-mono bg-background/30 rounded-lg px-3 py-2">
          {data.diff_summary}
        </div>
      )}

      {/* Prompt diff */}
      {data?.current_prompt && data?.proposed_prompt && (
        <div>
          <div className="text-xs text-foreground/40 uppercase tracking-wider font-mono mb-2">
            Prompt changes
          </div>
          <DiffViewer current={data.current_prompt} proposed={data.proposed_prompt} />
        </div>
      )}
    </div>
  );
}
