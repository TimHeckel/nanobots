interface BotToggleCardProps {
  result: unknown;
}

export function BotToggleCard({ result }: BotToggleCardProps) {
  const data = result as { botName?: string; enabled?: boolean; name?: string };
  const botName = data?.botName ?? data?.name ?? "bot";
  const enabled = data?.enabled ?? true;

  return (
    <div className="rounded-xl bg-indigo-deep/60 border border-purple-accent/15 p-4">
      <div className="flex items-center gap-2">
        <span className={`text-lg ${enabled ? "text-brand" : "text-amber-warn"}`}>
          {enabled ? "\u2713" : "\u2717"}
        </span>
        <span className={`font-mono text-sm ${enabled ? "text-brand" : "text-amber-warn"}`}>
          {botName}
        </span>
        <span className="text-foreground/50 text-sm">
          has been {enabled ? "enabled" : "disabled"}
        </span>
      </div>
    </div>
  );
}
