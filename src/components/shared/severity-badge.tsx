const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-500/20 text-red-400 border-red-500/30",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  medium: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  low: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

interface SeverityBadgeProps {
  severity: string;
}

export function SeverityBadge({ severity }: SeverityBadgeProps) {
  const normalized = severity.toLowerCase();
  const style = SEVERITY_STYLES[normalized] ?? "bg-foreground/10 text-foreground/60 border-foreground/20";

  return (
    <span
      className={`inline-block font-mono text-xs px-2 py-0.5 rounded-full border ${style}`}
    >
      {severity}
    </span>
  );
}
