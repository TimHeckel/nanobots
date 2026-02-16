interface WebhookItem {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  description?: string | null;
}

interface WebhookListCardProps {
  result: unknown;
}

export function WebhookListCard({ result }: WebhookListCardProps) {
  const data = result as { webhooks?: WebhookItem[]; message?: string };
  const webhooks = data?.webhooks ?? [];

  if (webhooks.length === 0) {
    return (
      <div className="rounded-xl bg-indigo-deep/60 border border-purple-accent/15 p-4 text-foreground/40 text-sm">
        {data?.message ?? "No webhooks configured."}
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-indigo-deep/60 border border-purple-accent/15 p-4 space-y-3">
      {webhooks.map((wh) => (
        <div
          key={wh.id}
          className="rounded-lg bg-background/30 border border-purple-accent/10 p-3"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-sm text-green-neon truncate max-w-[70%]">
              {wh.url}
            </span>
            <span
              className={`text-xs px-1.5 py-0.5 rounded ${
                wh.active
                  ? "bg-green-neon/15 text-green-neon"
                  : "bg-foreground/10 text-foreground/30"
              }`}
            >
              {wh.active ? "active" : "inactive"}
            </span>
          </div>
          {wh.description && (
            <div className="text-xs text-foreground/40 mb-2">
              {wh.description}
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {wh.events.map((evt) => (
              <span
                key={evt}
                className="inline-block text-xs font-mono px-2 py-0.5 rounded-full bg-purple-accent/15 text-purple-accent"
              >
                {evt}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
