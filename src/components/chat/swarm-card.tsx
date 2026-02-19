"use client";

interface SwarmCardProps {
  name: string;
  description: string | null;
  botCount: number;
}

export function SwarmCard({ name, description, botCount }: SwarmCardProps) {
  return (
    <div className="px-3 py-2 rounded-lg border border-foreground/5 bg-indigo-deep/30 hover:bg-indigo-deep/50 transition-colors">
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-xs font-medium text-foreground/70">
          {name}
        </span>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-purple-accent/10 text-purple-accent/60">
          {botCount} bot{botCount !== 1 ? "s" : ""}
        </span>
      </div>
      {description && (
        <p className="text-[11px] text-foreground/30 truncate">{description}</p>
      )}
    </div>
  );
}
