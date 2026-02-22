"use client";

interface BotCardProps {
  name: string;
  enabled: boolean;
}

export function BotCard({ name, enabled }: BotCardProps) {
  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-foreground/5 bg-indigo-deep/30 hover:bg-indigo-deep/50 transition-colors">
      <span className="font-mono text-xs text-foreground/70 truncate">
        {name}
      </span>
      <span
        className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
          enabled
            ? "bg-brand/10 text-brand/70"
            : "bg-foreground/5 text-foreground/30"
        }`}
      >
        {enabled ? "on" : "off"}
      </span>
    </div>
  );
}
