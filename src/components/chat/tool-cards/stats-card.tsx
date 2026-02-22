interface StatsData {
  total_scans?: number;
  total_findings?: number;
  total_prs?: number;
  findings_by_bot?: Record<string, number>;
}

interface StatsCardProps {
  result: unknown;
}

export function StatsCard({ result }: StatsCardProps) {
  const data = result as StatsData;
  const totalScans = data?.total_scans ?? 0;
  const totalFindings = data?.total_findings ?? 0;
  const totalPrs = data?.total_prs ?? 0;
  const findingsByBot = data?.findings_by_bot ?? {};
  const botEntries = Object.entries(findingsByBot);
  const maxFindings = botEntries.length > 0 ? Math.max(...botEntries.map(([, v]) => v)) : 0;

  return (
    <div className="rounded-xl bg-indigo-deep/60 border border-purple-accent/15 p-4 space-y-4">
      {/* Big numbers grid */}
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center">
          <div className="font-mono text-2xl font-bold text-brand">
            {totalScans}
          </div>
          <div className="text-xs text-foreground/40 mt-1">Scans</div>
        </div>
        <div className="text-center">
          <div className="font-mono text-2xl font-bold text-amber-warn">
            {totalFindings}
          </div>
          <div className="text-xs text-foreground/40 mt-1">Findings</div>
        </div>
        <div className="text-center">
          <div className="font-mono text-2xl font-bold text-purple-accent">
            {totalPrs}
          </div>
          <div className="text-xs text-foreground/40 mt-1">PRs</div>
        </div>
      </div>

      {/* Findings by bot */}
      {botEntries.length > 0 && (
        <div className="pt-3 border-t border-purple-accent/10 space-y-2">
          <div className="text-xs text-foreground/40 uppercase tracking-wider font-mono">
            Findings by bot
          </div>
          {botEntries.map(([bot, count]) => (
            <div key={bot} className="flex items-center gap-3">
              <span className="font-mono text-xs text-foreground/60 w-32 truncate flex-shrink-0">
                {bot}
              </span>
              <div className="flex-1 h-2 bg-background/40 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand/60 rounded-full transition-all"
                  style={{
                    width: maxFindings > 0 ? `${(count / maxFindings) * 100}%` : "0%",
                  }}
                />
              </div>
              <span className="font-mono text-xs text-foreground/40 w-8 text-right">
                {count}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
