interface SwarmData {
  swarm?: {
    name: string;
    description?: string | null;
    bots?: string[];
  };
  message?: string;
  success?: boolean;
}

interface SwarmCardProps {
  result: unknown;
}

export function SwarmCard({ result }: SwarmCardProps) {
  const data = result as SwarmData;
  const swarm = data?.swarm;

  return (
    <div className="rounded-xl bg-indigo-deep/60 border border-purple-accent/15 p-4">
      {swarm && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-brand">
              {swarm.name}
            </span>
            {data.success && (
              <span className="text-brand text-xs">{"\u2713"}</span>
            )}
          </div>
          {swarm.description && (
            <div className="text-xs text-foreground/40">
              {swarm.description}
            </div>
          )}
          {swarm.bots && swarm.bots.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
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
      )}
      {data?.message && (
        <div className="text-sm text-foreground/60 mt-2">{data.message}</div>
      )}
    </div>
  );
}
