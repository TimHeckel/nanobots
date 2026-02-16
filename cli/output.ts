import type { AnalyzerResult } from "./analyzer";


// ANSI color codes
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";
const CYAN = "\x1b[36m";
const MAGENTA = "\x1b[35m";
const WHITE = "\x1b[37m";

const SEVERITY_COLORS: Record<string, string> = {
  critical: RED + BOLD,
  high: RED,
  medium: YELLOW,
  low: DIM,
  info: CYAN,
};

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

const BOT_ICONS: Record<string, string> = {
  security: "🔒",
  quality: "🧹",
  docs: "📄",
};

function severityColor(severity: string): string {
  return SEVERITY_COLORS[severity] ?? DIM;
}

function padRight(str: string, len: number): string {
  return str.length >= len ? str : str + " ".repeat(len - str.length);
}

export function formatTerminal(
  results: AnalyzerResult[],
  model: string,
  startTime: number,
): string {
  const lines: string[] = [];
  let totalFindings = 0;
  let botsWithFindings = 0;

  for (const result of results) {
    if (result.findings.length === 0) continue;

    botsWithFindings++;
    totalFindings += result.findings.length;

    // Determine bot icon from bot name
    let icon = "🤖";
    if (result.bot.includes("security") || result.bot.includes("actions")) {
      icon = BOT_ICONS.security;
    } else if (result.bot.includes("quality")) {
      icon = BOT_ICONS.quality;
    } else if (
      result.bot.includes("readme") ||
      result.bot.includes("architecture") ||
      result.bot.includes("api-doc")
    ) {
      icon = BOT_ICONS.docs;
    }

    // Sort findings by severity
    const sorted = [...result.findings].sort(
      (a, b) =>
        (SEVERITY_ORDER[a.severity] ?? 5) - (SEVERITY_ORDER[b.severity] ?? 5),
    );

    const fixable = sorted.some((f) => f.fixedContent);
    const fixNote = fixable ? ` ${DIM}(fixable with --fix)${RESET}` : "";

    lines.push(
      `\n  ${icon} ${BOLD}${result.bot}${RESET}  ${result.findings.length} finding${result.findings.length !== 1 ? "s" : ""}${fixNote}`,
    );

    // Show up to 10 findings, then summarize
    const shown = sorted.slice(0, 10);
    for (const finding of shown) {
      const sevColor = severityColor(finding.severity);
      const sev = padRight(finding.severity.toUpperCase(), 8);
      const location = finding.line
        ? `${finding.file}:${finding.line}`
        : finding.file;

      lines.push(
        `    ${sevColor}${sev}${RESET}  ${DIM}${padRight(location, 35)}${RESET} ${finding.description}`,
      );
    }

    if (sorted.length > 10) {
      lines.push(
        `    ${DIM}... and ${sorted.length - 10} more${RESET}`,
      );
    }
  }

  // Summary line
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  if (totalFindings === 0) {
    lines.push(
      `\n  ${GREEN}${BOLD}✓${RESET} ${GREEN}No findings from ${results.length} bot${results.length !== 1 ? "s" : ""} in ${elapsed}s${RESET} ${DIM}(${model})${RESET}`,
    );
  } else {
    lines.push(
      `\n  ${RED}${BOLD}✗${RESET} ${WHITE}${totalFindings} finding${totalFindings !== 1 ? "s" : ""} from ${botsWithFindings} bot${botsWithFindings !== 1 ? "s" : ""} in ${elapsed}s${RESET} ${DIM}(${model})${RESET}`,
    );
  }

  return lines.join("\n");
}

export function formatJSON(results: AnalyzerResult[]): string {
  const output = {
    results: results.map((r) => ({
      bot: r.bot,
      findings: r.findings,
      filesScanned: r.filesScanned,
    })),
    summary: {
      totalFindings: results.reduce((sum, r) => sum + r.findings.length, 0),
      bots: results.length,
    },
  };

  return JSON.stringify(output, null, 2);
}

export function printScanHeader(
  model: string,
  totalFiles: number,
  sourceFiles: number,
): void {
  process.stderr.write(
    `\n  ${MAGENTA}Scanning with ${model} via OpenRouter...${RESET}\n`,
  );
  process.stderr.write(
    `  ${DIM}Found ${totalFiles} files, analyzing ${sourceFiles} source files${RESET}\n`,
  );
}
