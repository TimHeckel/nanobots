interface DocResult {
  repo?: string;
  docType?: string;
  prsCreated?: number;
  prUrls?: string[];
  botsRun?: string[];
  durationMs?: number;
  error?: string;
}

interface DocGenerationCardProps {
  result: unknown;
}

export function DocGenerationCard({ result }: DocGenerationCardProps) {
  const data = result as DocResult;

  if (data?.error) {
    return (
      <div className="rounded-xl bg-indigo-deep/60 border border-red-400/20 p-4">
        <div className="flex items-center gap-2">
          <span className="text-red-400">✗</span>
          <span className="text-sm text-red-400/80">{data.error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-indigo-deep/60 border border-purple-accent/15 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap text-sm">
        {data?.repo && (
          <span className="font-mono text-brand">{data.repo}</span>
        )}
        {data?.docType && (
          <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-purple-accent/15 text-purple-accent">
            {data.docType === "all" ? "All docs" : data.docType}
          </span>
        )}
        {data?.durationMs != null && (
          <span className="text-foreground/30 text-xs">
            {(data.durationMs / 1000).toFixed(1)}s
          </span>
        )}
      </div>

      {/* Bots run */}
      {data?.botsRun && data.botsRun.length > 0 && (
        <div className="space-y-2">
          {data.botsRun.map((bot) => (
            <div
              key={bot}
              className="flex items-center gap-2 rounded-lg bg-background/30 border border-purple-accent/10 px-3 py-2"
            >
              <span className="text-brand text-sm">✓</span>
              <span className="font-mono text-sm text-foreground/70">{bot}</span>
            </div>
          ))}
        </div>
      )}

      {/* PR Links */}
      {data?.prUrls && data.prUrls.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-purple-accent/10">
          <span className="text-xs text-foreground/40">Pull Requests</span>
          {data.prUrls.map((url, i) => (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-purple-accent hover:text-purple-accent/80 hover:underline font-mono"
            >
              <span>→</span>
              <span>View PR #{url.split("/").pop()}</span>
            </a>
          ))}
        </div>
      )}

      {/* Summary */}
      <div className="flex items-center justify-between pt-2 border-t border-purple-accent/10">
        <span className="text-sm text-foreground/40">Documentation PRs created</span>
        <span className="font-mono text-lg font-bold text-brand">
          {data?.prsCreated ?? 0}
        </span>
      </div>
    </div>
  );
}
