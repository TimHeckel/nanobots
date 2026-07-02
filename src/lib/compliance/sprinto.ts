import type { ActivityLogEntry } from "@/lib/db/schema";
import type { BotFinding } from "@/lib/nanobots/ai-bots/types";

export type SprintoControlStatus =
  | "pass"
  | "fail"
  | "in_progress"
  | "not_scanned";

export type SprintoMonitoringStatus =
  | "healthy"
  | "needs_attention"
  | "stale"
  | "not_scanned";

export type SprintoExceptionState =
  | "none"
  | "open"
  | "remediating"
  | "missing_data";

export type SprintoExportState =
  | "ready"
  | "action_required"
  | "blocked";

export interface ScanFindingEvidence extends BotFinding {
  botName: string;
}

export interface ScanEvidence {
  scanId: string;
  repo: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  totalFindings: number;
  totalPrs: number;
  botsRun: string[];
  botResults: Record<string, { findingCount: number; durationMs?: number }>;
  findingEvents: ScanFindingEvidence[];
  prUrls: string[];
}

export interface SprintoControlEntity {
  external_id: string;
  repo: string;
  scan_id: string;
  control_key: string;
  control_name: string;
  suggested_soc2_mapping: string;
  status: SprintoControlStatus;
  finding_count: number;
  highest_severity: "critical" | "high" | "medium" | "low" | "info" | "none";
  remediation_count: number;
  bots_csv: string;
  remediation_urls_csv: string;
  scan_started_at: string;
  scan_completed_at: string;
  summary: string;
  evidence_markdown: string;
  sample_findings_json: string;
  monitoring_status: SprintoMonitoringStatus;
  exception_state: SprintoExceptionState;
  sprinto_export_state: SprintoExportState;
}

export interface SprintoSyncResult {
  sessionId: string;
  pushedPages: number;
  pushedEntities: number;
  closeResponse: unknown;
  integrationStatus?: unknown;
}

export interface SprintoClientOptions {
  apiKey: string;
  baseUrl?: string;
  version?: "v1";
}

interface SessionResponse {
  id?: string;
  session_id?: string;
  session?: {
    id?: string;
    session_id?: string;
  };
}

const DEFAULT_SPRINTO_BASE_URL = "https://api.sprinto.com/api/external/push";
const DEFAULT_ENTITY_TYPE = "engineering_controls";
const PAGE_SIZE = 100;
const MONITORING_STALE_AFTER_DAYS = 14;

interface ControlEvaluation {
  status: SprintoControlStatus;
  findings: ScanFindingEvidence[];
  bots: string[];
}

interface ControlTemplate {
  key: string;
  name: string;
  mapping: string;
  evaluate(scan: ScanEvidence): ControlEvaluation;
}

const CONTROL_TEMPLATES = [
  {
    key: "NB-CC-001",
    name: "Security scan executed on repository changes",
    mapping: "CC7.2 / CC8.1",
    evaluate(scan: ScanEvidence) {
      const scanned = Boolean(scan.completedAt);
      return {
        status: scanned ? "pass" : ("fail" as SprintoControlStatus),
        findings: [] as ScanFindingEvidence[],
        bots: scan.botsRun,
      };
    },
  },
  {
    key: "NB-CC-002",
    name: "No application security findings remain in the scanned revision",
    mapping: "CC7.1 / CC7.2",
    evaluate(scan: ScanEvidence) {
      const relevant = filterFindingsByBots(scan.findingEvents, ["security-scanner"]);
      return {
        status: statusFromFindings(scan, relevant, ["security-scanner"]),
        findings: relevant,
        bots: ["security-scanner"],
      };
    },
  },
  {
    key: "NB-CC-003",
    name: "GitHub Actions workflows are hardened",
    mapping: "CC6.1 / CC7.2",
    evaluate(scan: ScanEvidence) {
      const relevant = filterFindingsByBots(scan.findingEvents, ["actions-hardening"]);
      return {
        status: statusFromFindings(scan, relevant, ["actions-hardening"]),
        findings: relevant,
        bots: ["actions-hardening"],
      };
    },
  },
  {
    key: "NB-CC-004",
    name: "Open scan findings have a remediation artifact",
    mapping: "CC7.2 / CC7.3",
    evaluate(scan: ScanEvidence) {
      return {
        status:
          scan.totalFindings === 0
            ? "pass"
            : scan.prUrls.length > 0
              ? "in_progress"
              : "fail",
        findings: scan.findingEvents,
        bots: scan.botsRun,
      };
    },
  },
] satisfies ControlTemplate[];

function filterFindingsByBots(
  findings: ScanFindingEvidence[],
  bots: string[],
): ScanFindingEvidence[] {
  const allowed = new Set(bots);
  return findings.filter((finding) => allowed.has(finding.botName));
}

function statusFromFindings(
  scan: ScanEvidence,
  findings: ScanFindingEvidence[],
  expectedBots: string[],
): SprintoControlStatus {
  const hasRun = expectedBots.some(
    (bot) =>
      scan.botsRun.includes(bot) ||
      scan.botResults[bot] !== undefined,
  );

  if (!hasRun) return "not_scanned";
  return findings.length === 0 ? "pass" : "fail";
}

function severityRank(
  severity: "critical" | "high" | "medium" | "low" | "info",
): number {
  switch (severity) {
    case "critical":
      return 5;
    case "high":
      return 4;
    case "medium":
      return 3;
    case "low":
      return 2;
    case "info":
      return 1;
  }
}

function getHighestSeverity(
  findings: ScanFindingEvidence[],
): SprintoControlEntity["highest_severity"] {
  if (findings.length === 0) return "none";

  return findings.reduce((highest, finding) => {
    if (highest === "none") return finding.severity;
    return severityRank(finding.severity) > severityRank(highest)
      ? finding.severity
      : highest;
  }, "none" as SprintoControlEntity["highest_severity"]);
}

function toIsoString(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  if (value instanceof Date) return value.toISOString();
  return undefined;
}

function getString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isBotFinding(value: unknown): value is BotFinding {
  if (!value || typeof value !== "object") return false;
  const finding = value as Record<string, unknown>;
  return (
    typeof finding.file === "string" &&
    typeof finding.severity === "string" &&
    typeof finding.category === "string" &&
    typeof finding.description === "string"
  );
}

function applyRepoMetadata(scan: ScanEvidence, value: unknown): void {
  const repo = getString(value);
  if (repo) {
    scan.repo = repo;
  }
}

function appendPrUrl(scan: ScanEvidence, value: unknown): void {
  const prUrl = getString(value);
  if (prUrl === undefined) return;
  scan.prUrls.push(prUrl);
}

function normalizeActivityTimestamp(
  entry: ActivityLogEntry,
  metadataTimestamp: unknown,
): string {
  return toIsoString(metadataTimestamp) ?? entry.created_at.toISOString();
}

function getSortTimestamp(scan: ScanEvidence): number {
  const timestamp = scan.completedAt ?? scan.startedAt;
  if (!timestamp) {
    return 0;
  }

  return new Date(timestamp).getTime();
}

export function buildScansFromActivity(activity: ActivityLogEntry[]): ScanEvidence[] {
  const scans = new Map<string, ScanEvidence>();
  const sorted = [...activity].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  for (const entry of sorted) {
    const metadata = entry.metadata ?? {};
    const scanId = getString(metadata.scanId);
    if (!scanId) continue;

    const scan = scans.get(scanId) ?? {
      scanId,
      repo: "",
      startedAt: undefined,
      completedAt: undefined,
      durationMs: undefined,
      totalFindings: 0,
      totalPrs: 0,
      botsRun: [],
      botResults: {},
      findingEvents: [],
      prUrls: [],
    };

    if (!scans.has(scanId)) {
      scans.set(scanId, scan);
    }

    switch (entry.event_type) {
      case "scan.started": {
        applyRepoMetadata(scan, metadata.repo);
        scan.startedAt = normalizeActivityTimestamp(entry, metadata.timestamp);
        break;
      }
      case "scan.completed": {
        applyRepoMetadata(scan, metadata.repo);
        scan.completedAt = normalizeActivityTimestamp(entry, metadata.timestamp);
        scan.durationMs =
          typeof metadata.durationMs === "number"
            ? metadata.durationMs
            : scan.durationMs;
        scan.totalFindings =
          typeof metadata.totalFindings === "number"
            ? metadata.totalFindings
            : scan.totalFindings;
        scan.totalPrs =
          typeof metadata.totalPrs === "number"
            ? metadata.totalPrs
            : scan.totalPrs;
        if (Array.isArray(metadata.botsRun)) {
          scan.botsRun = metadata.botsRun
            .filter((bot): bot is string => typeof bot === "string");
        }
        if (Array.isArray(metadata.findings)) {
          for (const finding of metadata.findings) {
            if (
              finding &&
              typeof finding === "object" &&
              typeof (finding as { bot?: unknown }).bot === "string" &&
              typeof (finding as { findingCount?: unknown }).findingCount === "number"
            ) {
              const botName = (finding as { bot: string }).bot;
              scan.botResults[botName] = {
                findingCount: (finding as { findingCount: number }).findingCount,
              };
              appendPrUrl(scan, (finding as { prUrl?: unknown }).prUrl);
            }
          }
        }
        break;
      }
      case "bot.completed": {
        const botName = getString(metadata.botName);
        if (!botName) break;
        scan.botResults[botName] = {
          findingCount:
            typeof metadata.findingCount === "number"
              ? metadata.findingCount
              : 0,
          durationMs:
            typeof metadata.durationMs === "number"
              ? metadata.durationMs
              : undefined,
        };
        scan.botsRun.push(botName);
        break;
      }
      case "bot.finding": {
        const botName = getString(metadata.botName);
        const finding = metadata.finding;
        if (!botName || !isBotFinding(finding)) break;

        scan.findingEvents.push({
          botName,
          file: finding.file,
          line: finding.line,
          severity: finding.severity,
          category: finding.category,
          description: finding.description,
          suggestion: finding.suggestion,
          fixedContent: finding.fixedContent,
        });
        if (!scan.botsRun.includes(botName)) {
          scan.botsRun.push(botName);
        }
        break;
      }
      case "pr.created": {
        applyRepoMetadata(scan, metadata.repo);
        appendPrUrl(scan, metadata.prUrl);
        const botName = getString(metadata.botName);
        if (botName && !scan.botsRun.includes(botName)) {
          scan.botsRun.push(botName);
        }
        break;
      }
      default:
        break;
    }
  }

  return [...scans.values()]
    .filter((scan) => scan.repo.length > 0)
    .map((scan) => ({
      ...scan,
      prUrls: [...new Set(scan.prUrls)],
      botsRun: [...new Set(scan.botsRun)],
    }))
    .sort((a, b) => getSortTimestamp(b) - getSortTimestamp(a));
}

function buildEvidenceMarkdown(
  controlName: string,
  scan: ScanEvidence,
  findings: ScanFindingEvidence[],
): string {
  const lines = [
    `# ${controlName}`,
    "",
    `- Repository: ${scan.repo}`,
    `- Scan ID: ${scan.scanId}`,
    `- Started: ${scan.startedAt ?? "unknown"}`,
    `- Completed: ${scan.completedAt ?? "unknown"}`,
    `- Findings: ${findings.length}`,
    `- Remediation artifacts: ${scan.prUrls.length}`,
  ];

  if (scan.prUrls.length > 0) {
    lines.push("", "## Remediation artifacts");
    for (const prUrl of scan.prUrls) {
      lines.push(`- ${prUrl}`);
    }
  }

  if (findings.length > 0) {
    lines.push("", "## Sample findings");
    for (const finding of findings.slice(0, 5)) {
      const location = finding.line
        ? `${finding.file}:${finding.line}`
        : finding.file;
      lines.push(
        `- [${finding.severity}] ${finding.botName} at ${location}: ${finding.description}`,
      );
    }
  }

  return lines.join("\n");
}

function buildSummary(
  status: SprintoControlStatus,
  scan: ScanEvidence,
  findings: ScanFindingEvidence[],
): string {
  switch (status) {
    case "pass":
      return `Repository ${scan.repo} passed this nanobots engineering control in scan ${scan.scanId}.`;
    case "in_progress":
      return `Repository ${scan.repo} has ${findings.length} finding(s) with remediation artifacts open for scan ${scan.scanId}.`;
    case "not_scanned":
      return `Repository ${scan.repo} did not run the bot(s) required for this control in scan ${scan.scanId}.`;
    case "fail":
      return `Repository ${scan.repo} failed this nanobots engineering control with ${findings.length} finding(s) in scan ${scan.scanId}.`;
  }
}

function getMonitoringStatus(
  scan: ScanEvidence,
  evaluation: ControlEvaluation,
): SprintoMonitoringStatus {
  if (!scan.completedAt) return "not_scanned";

  const completedAt = new Date(scan.completedAt).getTime();
  const staleAfterMs = MONITORING_STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
  if (Number.isFinite(completedAt) && Date.now() - completedAt > staleAfterMs) {
    return "stale";
  }

  if (evaluation.status === "pass") return "healthy";
  return "needs_attention";
}

function getExceptionState(
  scan: ScanEvidence,
  evaluation: ControlEvaluation,
): SprintoExceptionState {
  switch (evaluation.status) {
    case "pass":
      return "none";
    case "in_progress":
      return "remediating";
    case "not_scanned":
      return "missing_data";
    case "fail":
      return evaluation.findings.length > 0 || scan.totalFindings > 0
        ? "open"
        : "missing_data";
  }
}

function getSprintoExportState(
  scan: ScanEvidence,
  evaluation: ControlEvaluation,
): SprintoExportState {
  if (!scan.completedAt || scan.repo.length === 0) return "blocked";

  if (evaluation.status === "fail" && scan.prUrls.length === 0) {
    return "action_required";
  }

  return "ready";
}

export function buildSprintoControlEntities(
  scans: ScanEvidence[],
): SprintoControlEntity[] {
  const entities: SprintoControlEntity[] = [];

  for (const scan of scans) {
    for (const control of CONTROL_TEMPLATES) {
      const evaluation = control.evaluate(scan);
      entities.push({
        external_id: `${scan.scanId}:${control.key}`,
        repo: scan.repo,
        scan_id: scan.scanId,
        control_key: control.key,
        control_name: control.name,
        suggested_soc2_mapping: control.mapping,
        status: evaluation.status,
        finding_count: evaluation.findings.length,
        highest_severity: getHighestSeverity(evaluation.findings),
        remediation_count: scan.prUrls.length,
        bots_csv: evaluation.bots.join(","),
        remediation_urls_csv: scan.prUrls.join(","),
        scan_started_at: scan.startedAt ?? "",
        scan_completed_at: scan.completedAt ?? "",
        summary: buildSummary(evaluation.status, scan, evaluation.findings),
        evidence_markdown: buildEvidenceMarkdown(
          control.name,
          scan,
          evaluation.findings,
        ),
        monitoring_status: getMonitoringStatus(scan, evaluation),
        exception_state: getExceptionState(scan, evaluation),
        sprinto_export_state: getSprintoExportState(scan, evaluation),
        sample_findings_json: JSON.stringify(
          evaluation.findings.slice(0, 10).map((finding) => ({
            botName: finding.botName,
            file: finding.file,
            line: finding.line,
            severity: finding.severity,
            category: finding.category,
            description: finding.description,
            suggestion: finding.suggestion,
          })),
        ),
      });
    }
  }

  return entities;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export class SprintoPushClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly version: "v1";

  constructor(options: SprintoClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? DEFAULT_SPRINTO_BASE_URL;
    this.version = options.version ?? "v1";
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "api-key": this.apiKey,
        ...(init?.headers ?? {}),
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Sprinto API request failed (${response.status}): ${text || response.statusText}`,
      );
    }

    return (await response.json()) as T;
  }

  async getIntegrationStatus(integrationId: string): Promise<unknown> {
    return this.request(
      `/${this.version}/integrations/${integrationId}/status`,
      { method: "GET" },
    );
  }

  async createSession(integrationId: string): Promise<string> {
    const response = await this.request<SessionResponse>(
      `/${this.version}/integrations/${integrationId}/sessions`,
      { method: "POST", body: JSON.stringify({}) },
    );

    const sessionId =
      response.session_id ??
      response.id ??
      response.session?.session_id ??
      response.session?.id;

    if (!sessionId) {
      throw new Error("Sprinto session response did not include a session id");
    }

    return sessionId;
  }

  async pushEntityPage(
    integrationId: string,
    sessionId: string,
    entityType: string,
    entities: SprintoControlEntity[],
    pageHint: string,
  ): Promise<unknown> {
    return this.request(
      `/${this.version}/integrations/${integrationId}/sessions/${sessionId}/entities`,
      {
        method: "POST",
        body: JSON.stringify({
          page_hint: pageHint,
          entities: {
            [entityType || DEFAULT_ENTITY_TYPE]: entities,
          },
        }),
      },
    );
  }

  async closeSession(
    integrationId: string,
    sessionId: string,
    action: "apply" | "discard" = "apply",
  ): Promise<unknown> {
    return this.request(
      `/${this.version}/integrations/${integrationId}/sessions/${sessionId}/close`,
      {
        method: "POST",
        body: JSON.stringify({ action }),
      },
    );
  }

  async syncEngineeringControls(params: {
    integrationId: string;
    entityType?: string;
    entities: SprintoControlEntity[];
  }): Promise<SprintoSyncResult> {
    const entityType = params.entityType ?? DEFAULT_ENTITY_TYPE;
    const sessionId = await this.createSession(params.integrationId);
    const pages = chunk(params.entities, PAGE_SIZE);

    for (let index = 0; index < pages.length; index += 1) {
      await this.pushEntityPage(
        params.integrationId,
        sessionId,
        entityType,
        pages[index],
        `page-${index + 1}`,
      );
    }

    const closeResponse = await this.closeSession(
      params.integrationId,
      sessionId,
      "apply",
    );

    let integrationStatus: unknown;
    try {
      integrationStatus = await this.getIntegrationStatus(params.integrationId);
    } catch {
      integrationStatus = undefined;
    }

    return {
      sessionId,
      pushedPages: pages.length,
      pushedEntities: params.entities.length,
      closeResponse,
      integrationStatus,
    };
  }
}
