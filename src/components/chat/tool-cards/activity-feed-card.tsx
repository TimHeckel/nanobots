interface ActivityEntry {
  timestamp: string;
  event_type: string;
  summary: string;
}

interface ActivityFeedCardProps {
  result: unknown;
}

function formatRelativeTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;

    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  } catch {
    return timestamp;
  }
}

export function ActivityFeedCard({ result }: ActivityFeedCardProps) {
  const data = result as { entries?: ActivityEntry[] };
  const entries = data?.entries ?? (Array.isArray(result) ? (result as ActivityEntry[]) : []);

  if (entries.length === 0) {
    return (
      <div className="rounded-xl bg-indigo-deep/60 border border-purple-accent/15 p-4 text-foreground/40 text-sm">
        No recent activity.
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-indigo-deep/60 border border-purple-accent/15 p-4">
      <div className="relative">
        {/* Vertical connector line */}
        <div className="absolute left-[5px] top-2 bottom-2 w-px bg-purple-accent/15" />

        <div className="space-y-4">
          {entries.map((entry, i) => (
            <div key={i} className="flex items-start gap-3 relative">
              <span className="relative z-10 mt-1.5 flex-shrink-0 w-[11px] h-[11px] rounded-full border-2 border-purple-accent/40 bg-indigo-deep" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-block font-mono text-xs px-1.5 py-0.5 rounded bg-purple-accent/15 text-purple-accent">
                    {entry.event_type}
                  </span>
                  <span className="text-xs text-foreground/30">
                    {formatRelativeTime(entry.timestamp)}
                  </span>
                </div>
                <div className="text-sm text-foreground/60 mt-1">
                  {entry.summary}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
