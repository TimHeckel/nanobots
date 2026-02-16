interface DiffViewerProps {
  current: string;
  proposed: string;
}

export function DiffViewer({ current, proposed }: DiffViewerProps) {
  const currentLines = current.split("\n");
  const proposedLines = proposed.split("\n");

  const currentSet = new Set(currentLines);
  const proposedSet = new Set(proposedLines);

  // Build a combined view: removed lines, then common/added
  const allLines: { text: string; type: "removed" | "added" | "common" }[] = [];

  // Lines only in current (removed)
  for (const line of currentLines) {
    if (!proposedSet.has(line)) {
      allLines.push({ text: line, type: "removed" });
    } else {
      allLines.push({ text: line, type: "common" });
    }
  }

  // Lines only in proposed (added) that weren't already shown
  for (const line of proposedLines) {
    if (!currentSet.has(line)) {
      allLines.push({ text: line, type: "added" });
    }
  }

  return (
    <div className="rounded-lg border border-purple-accent/15 bg-background/60 overflow-hidden font-mono text-xs">
      <div className="flex items-center gap-4 px-3 py-2 border-b border-purple-accent/10 text-foreground/40">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-red-500/30" />
          Removed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-green-500/30" />
          Added
        </span>
      </div>
      <div className="p-3 space-y-0">
        {allLines.map((line, i) => {
          let bgClass = "text-foreground/30";
          let prefix = " ";
          if (line.type === "removed") {
            bgClass = "bg-red-500/10 text-red-400/80";
            prefix = "-";
          } else if (line.type === "added") {
            bgClass = "bg-green-500/10 text-green-400/80";
            prefix = "+";
          }

          return (
            <div key={i} className={`px-2 py-0.5 ${bgClass}`}>
              <span className="select-none mr-2 opacity-60">{prefix}</span>
              {line.text || "\u00A0"}
            </div>
          );
        })}
      </div>
    </div>
  );
}
