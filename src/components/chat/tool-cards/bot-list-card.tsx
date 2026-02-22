interface Bot {
  name: string;
  description?: string;
  enabled: boolean;
}

interface BotListCardProps {
  result: unknown;
}

export function BotListCard({ result }: BotListCardProps) {
  const data = result as { bots?: Bot[] };
  const bots = data?.bots ?? (Array.isArray(result) ? (result as Bot[]) : []);

  if (bots.length === 0) {
    return (
      <div className="rounded-xl bg-indigo-deep/60 border border-purple-accent/15 p-4 text-foreground/40 text-sm">
        No bots configured.
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-indigo-deep/60 border border-purple-accent/15 p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {bots.map((bot) => (
          <div
            key={bot.name}
            className="flex items-start gap-3 rounded-lg bg-background/30 border border-purple-accent/10 p-3"
          >
            <span
              className={`mt-1.5 flex-shrink-0 w-2 h-2 rounded-full ${
                bot.enabled ? "bg-brand" : "bg-foreground/20"
              }`}
            />
            <div className="min-w-0">
              <div className="font-mono text-sm text-brand truncate">
                {bot.name}
              </div>
              {bot.description && (
                <div className="text-xs text-foreground/40 mt-0.5 leading-relaxed">
                  {bot.description}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
