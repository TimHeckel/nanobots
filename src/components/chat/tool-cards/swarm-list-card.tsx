interface SwarmItem {
  name: string;
  description?: string | null;
  botCount: number;
  bots: string[];
}

interface SwarmListCardProps {
  result: unknown;
}

export function SwarmListCard({ result }: SwarmListCardProps) {
  const data = result as { swarms?: SwarmItem[]; message?: string };
  const swarms = data?.swarms ?? [];

  if (swarms.length === 0) {
    return (
      <div className="rounded-xl bg-indigo-deep/60 border border-purple-accent/15 p-4 text-foreground/40 text-sm">
        {data?.message ?? "No swarms configured."}
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-indigo-deep/60 border border-purple-accent/15 p-4 space-y-3">
      {swarms.map((swarm) => (
        <div
          key={swarm.name}
          className="rounded-lg bg-background/30 border border-purple-accent/10 p-3"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-sm text-brand">
              {swarm.name}
            </span>
            <span className="text-xs text-foreground/30">
              {swarm.botCount} bot{swarm.botCount !== 1 ? "s" : ""}
            </span>
          </div>
          {swarm.description && (
            <div className="text-xs text-foreground/40 mb-2">
              {swarm.description}
            </div>
          )}
          {swarm.bots.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {swarm.bots.map((bot) => (
                <span
                  key={bot}
                  className="inline-block text-xs font-mono px-2 py-0.5 rounded-full bg-purple-accent/15 text-purple-accent"
                >
                  {bot}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
