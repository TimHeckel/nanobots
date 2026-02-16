interface BotResult {
  bot_name: string;
  finding_count: number;
  pr_url?: string | null;
}

interface ScanData {
  repo?: string;
  trigger_type?: string;
  duration_ms?: number;
  bot_results?: BotResult[];
  total_findings?: number;
}

interface ScanResultsCardProps {
  result: unknown;
}

export function ScanResultsCard({ result }: ScanResultsCardProps) {
  const data = result as ScanData;
  const botResults = data?.bot_results ?? [];
  const totalFindings =
    data?.total_findings ??
    botResults.reduce((sum, r) => sum + (r.finding_count ?? 0), 0);

  return (
    <div className="rounded-xl bg-indigo-deep/60 border border-purple-accent/15 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap text-sm">
        {data?.repo && (
          <span className="font-mono text-green-neon">{data.repo}</span>
        )}
        {data?.trigger_type && (
          <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-purple-accent/15 text-purple-accent">
            {data.trigger_type}
          </span>
        )}
        {data?.duration_ms != null && (
          <span className="text-foreground/30 text-xs">
            {(data.duration_ms / 1000).toFixed(1)}s
          </span>
        )}
      </div>

      {/* Bot results */}
      {botResults.length > 0 && (
        <div className="space-y-2">
          {botResults.map((br) => (
            <div
              key={br.bot_name}
              className="flex items-center justify-between rounded-lg bg-background/30 border border-purple-accent/10 px-3 py-2"
            >
              <span className="font-mono text-sm text-foreground/70">
                {br.bot_name}
              </span>
              <div className="flex items-center gap-3">
                <span
                  className={`font-mono text-sm ${
                    br.finding_count > 0 ? "text-amber-warn" : "text-green-neon"
                  }`}
                >
                  {br.finding_count} finding{br.finding_count !== 1 ? "s" : ""}
                </span>
                {br.pr_url && (
                  <a
                    href={br.pr_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-purple-accent hover:underline"
                  >
                    PR
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Total */}
      <div className="flex items-center justify-between pt-2 border-t border-purple-accent/10">
        <span className="text-sm text-foreground/40">Total findings</span>
        <span
          className={`font-mono text-lg font-bold ${
            totalFindings > 0 ? "text-amber-warn" : "text-green-neon"
          }`}
        >
          {totalFindings}
        </span>
      </div>
    </div>
  );
}
