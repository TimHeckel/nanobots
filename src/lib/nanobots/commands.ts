export interface ParsedCommand {
  type: "scan" | "find" | "help" | "unknown";
  args: string;
  raw: string;
}

/**
 * Parse a GitHub comment body for an @nanobots command.
 * Returns null if @nanobots is not mentioned.
 */
export function parseCommand(commentBody: string): ParsedCommand | null {
  const match = commentBody.match(/@nanobots\s*(.*)/i);
  if (!match) return null;

  const raw = match[1].trim();
  const lower = raw.toLowerCase();

  // scan / check
  if (!raw || /^(scan|check)\b/i.test(raw)) {
    return { type: "scan", args: raw, raw };
  }

  // find / search
  const findMatch = raw.match(/^(?:find|search(?:\s+for)?)\s+(.+)/i);
  if (findMatch) {
    return { type: "find", args: findMatch[1].trim(), raw };
  }

  // help
  if (/^(help|what can you do)\b/i.test(lower)) {
    return { type: "help", args: "", raw };
  }

  return { type: "unknown", args: raw, raw };
}
