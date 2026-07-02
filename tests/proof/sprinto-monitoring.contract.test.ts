import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildScansFromActivity,
  buildSprintoControlEntities,
  SprintoPushClient,
  type ScanEvidence,
  type SprintoControlEntity,
} from "@/lib/compliance/sprinto";
import type { ActivityLogEntry } from "@/lib/db/schema";

describe("Sprinto middleware monitoring contract", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function makeScan(overrides: Partial<ScanEvidence> = {}): ScanEvidence {
    return {
      scanId: "scan_1",
      repo: "acme/api",
      startedAt: "2026-03-23T12:00:00.000Z",
      completedAt: "2026-03-23T12:05:00.000Z",
      durationMs: 300000,
      totalFindings: 1,
      totalPrs: 0,
      botsRun: ["security-scanner"],
      botResults: {
        "security-scanner": {
          findingCount: 1,
          durationMs: 1200,
        },
      },
      findingEvents: [
        {
          botName: "security-scanner",
          file: "src/auth.ts",
          line: 42,
          severity: "high",
          category: "auth",
          description: "Missing authorization check",
        },
      ],
      prUrls: [],
      ...overrides,
    };
  }

  function makeActivityEntry(
    overrides: Partial<ActivityLogEntry> = {},
  ): ActivityLogEntry {
    return {
      id: "activity_1",
      org_id: "org_1",
      event_type: "scan.started",
      summary: "scan event",
      metadata: {},
      actor_id: "user_1",
      created_at: new Date("2026-03-23T12:00:00.000Z"),
      ...overrides,
    };
  }

  function makeEntity(index: number): SprintoControlEntity {
    const [entity] = buildSprintoControlEntities([
      makeScan({
        scanId: `scan_${index}`,
        totalFindings: 0,
        totalPrs: 0,
        findingEvents: [],
        prUrls: [],
        botResults: {
          "security-scanner": {
            findingCount: 0,
            durationMs: 1200,
          },
        },
      }),
    ]);

    return {
      ...entity,
      external_id: `entity_${index}`,
    };
  }

  it("marks passing controls as healthy and ready for Sprinto export", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-26T12:00:00.000Z"));

    const [entity] = buildSprintoControlEntities([
      makeScan({
        totalFindings: 0,
        botResults: {
          "security-scanner": {
            findingCount: 0,
            durationMs: 1200,
          },
        },
        findingEvents: [],
      }),
    ]).filter((candidate) => candidate.control_key === "NB-CC-002");

    expect(entity.monitoring_status).toBe("healthy");
    expect(entity.exception_state).toBe("none");
    expect(entity.sprinto_export_state).toBe("ready");
  });

  it("marks failing controls without remediation as needing attention and action", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-26T12:00:00.000Z"));

    const [entity] = buildSprintoControlEntities([makeScan()]).filter(
      (candidate) => candidate.control_key === "NB-CC-002",
    );

    expect(entity.monitoring_status).toBe("needs_attention");
    expect(entity.exception_state).toBe("open");
    expect(entity.sprinto_export_state).toBe("action_required");
  });

  it("marks stale scans distinctly and blocks export when a required bot did not run", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-26T12:00:00.000Z"));

    const [entity] = buildSprintoControlEntities([
      makeScan({
        completedAt: "2026-03-01T12:05:00.000Z",
        botsRun: [],
        botResults: {},
        findingEvents: [],
      }),
    ]).filter((candidate) => candidate.control_key === "NB-CC-003");

    expect(entity.monitoring_status).toBe("stale");
    expect(entity.exception_state).toBe("missing_data");
    expect(entity.sprinto_export_state).toBe("ready");
  });

  it("blocks export and reports missing data when the scan never completed", () => {
    const [entity] = buildSprintoControlEntities([
      makeScan({
        completedAt: undefined,
        totalFindings: 0,
        findingEvents: [],
        prUrls: [],
      }),
    ]).filter((candidate) => candidate.control_key === "NB-CC-001");

    expect(entity.monitoring_status).toBe("not_scanned");
    expect(entity.exception_state).toBe("missing_data");
    expect(entity.sprinto_export_state).toBe("blocked");
  });

  it("serializes a missing startedAt value as an empty Sprinto field", () => {
    const [entity] = buildSprintoControlEntities([
      makeScan({
        startedAt: undefined,
        completedAt: "2026-03-23T12:05:00.000Z",
        totalFindings: 0,
        findingEvents: [],
        prUrls: [],
      }),
    ]).filter((candidate) => candidate.control_key === "NB-CC-001");

    expect(entity.scan_started_at).toBe("");
    expect(entity.scan_completed_at).toBe("2026-03-23T12:05:00.000Z");
  });

  it("marks remediation-backed findings as remediating and preserves evidence detail", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-26T12:00:00.000Z"));

    const [entity] = buildSprintoControlEntities([
      makeScan({
        totalFindings: 2,
        totalPrs: 1,
        prUrls: ["https://github.com/acme/api/pull/42"],
      }),
    ]).filter((candidate) => candidate.control_key === "NB-CC-004");

    expect(entity.status).toBe("in_progress");
    expect(entity.monitoring_status).toBe("needs_attention");
    expect(entity.exception_state).toBe("remediating");
    expect(entity.sprinto_export_state).toBe("ready");
    expect(entity.evidence_markdown).toContain("## Remediation artifacts");
    expect(entity.summary).toContain("remediation artifacts open");
  });

  it("escalates highest severity when later findings outrank the current maximum", () => {
    const [entity] = buildSprintoControlEntities([
      makeScan({
        totalFindings: 5,
        findingEvents: [
          {
            botName: "security-scanner",
            file: "src/a.ts",
            severity: "low",
            category: "auth",
            description: "Low severity finding",
          },
          {
            botName: "security-scanner",
            file: "src/b.ts",
            severity: "info",
            category: "auth",
            description: "Informational finding",
          },
          {
            botName: "security-scanner",
            file: "src/c.ts",
            severity: "medium",
            category: "auth",
            description: "Medium severity finding",
          },
          {
            botName: "security-scanner",
            file: "src/d.ts",
            severity: "high",
            category: "auth",
            description: "High severity finding",
          },
          {
            botName: "security-scanner",
            file: "src/e.ts",
            severity: "critical",
            category: "auth",
            description: "Critical severity finding",
          },
        ],
      }),
    ]).filter((candidate) => candidate.control_key === "NB-CC-004");

    expect(entity.highest_severity).toBe("critical");
  });

  it("reconstructs scans from activity logs while ignoring invalid metadata", () => {
    const scans = buildScansFromActivity([
      makeActivityEntry({
        id: "ignored",
        event_type: "scan.started",
        metadata: { repo: "acme/ignored" },
      }),
      makeActivityEntry({
        id: "start",
        event_type: "scan.started",
        metadata: {
          scanId: "scan_1",
          repo: "acme/api",
          timestamp: new Date("2026-03-23T12:00:00.000Z"),
        },
      }),
      makeActivityEntry({
        id: "bot-complete",
        event_type: "bot.completed",
        metadata: {
          scanId: "scan_1",
          botName: "security-scanner",
          findingCount: 2,
          durationMs: 900,
        },
      }),
      makeActivityEntry({
        id: "invalid-finding",
        event_type: "bot.finding",
        metadata: {
          scanId: "scan_1",
          botName: "security-scanner",
          finding: { file: "src/auth.ts" },
        },
      }),
      makeActivityEntry({
        id: "finding",
        event_type: "bot.finding",
        metadata: {
          scanId: "scan_1",
          botName: "security-scanner",
          finding: {
            file: "src/auth.ts",
            line: 42,
            severity: "high",
            category: "auth",
            description: "Missing authorization check",
          },
        },
      }),
      makeActivityEntry({
        id: "pr-created",
        event_type: "pr.created",
        metadata: {
          scanId: "scan_1",
          repo: "acme/api",
          botName: "security-scanner",
          prUrl: "https://github.com/acme/api/pull/42",
        },
      }),
      makeActivityEntry({
        id: "complete",
        event_type: "scan.completed",
        created_at: new Date("2026-03-23T12:05:00.000Z"),
        metadata: {
          scanId: "scan_1",
          repo: "acme/api",
          durationMs: 300000,
          totalFindings: 2,
          totalPrs: 1,
          botsRun: ["security-scanner", 42],
          findings: [
            {
              bot: "security-scanner",
              findingCount: 2,
              prUrl: "https://github.com/acme/api/pull/42",
            },
            {
              bot: 42,
              findingCount: "bad",
            },
          ],
        },
      }),
    ]);

    expect(scans).toEqual([
      {
        scanId: "scan_1",
        repo: "acme/api",
        startedAt: "2026-03-23T12:00:00.000Z",
        completedAt: "2026-03-23T12:05:00.000Z",
        durationMs: 300000,
        totalFindings: 2,
        totalPrs: 1,
        botsRun: ["security-scanner"],
        botResults: {
          "security-scanner": {
            findingCount: 2,
          },
        },
        findingEvents: [
          {
            botName: "security-scanner",
            file: "src/auth.ts",
            line: 42,
            severity: "high",
            category: "auth",
            description: "Missing authorization check",
            suggestion: undefined,
            fixedContent: undefined,
          },
        ],
        prUrls: ["https://github.com/acme/api/pull/42"],
      },
    ]);
  });

  it("ignores unknown activity events and orders scans by freshest available evidence timestamp", () => {
    const scans = buildScansFromActivity([
      makeActivityEntry({
        id: "unknown",
        created_at: new Date("2026-03-23T11:00:00.000Z"),
        event_type: "scan.unknown",
        metadata: {
          scanId: "scan_unknown",
          repo: "acme/ignored",
        },
      }),
      makeActivityEntry({
        id: "pr-only",
        created_at: new Date("2026-03-23T12:01:00.000Z"),
        event_type: "pr.created",
        metadata: {
          scanId: "scan_pr_only",
          repo: "acme/pr-only",
          botName: "evidence-capture",
          prUrl: "https://github.com/acme/pr-only/pull/9",
        },
      }),
      makeActivityEntry({
        id: "started-only",
        created_at: new Date("2026-03-23T12:02:00.000Z"),
        event_type: "scan.started",
        metadata: {
          scanId: "scan_started_only",
          repo: "acme/started-only",
          timestamp: new Date("2026-03-23T12:02:00.000Z"),
        },
      }),
      makeActivityEntry({
        id: "latest-start",
        created_at: new Date("2026-03-23T12:03:00.000Z"),
        event_type: "scan.started",
        metadata: {
          scanId: "scan_latest",
          repo: "acme/latest",
          timestamp: new Date("2026-03-23T12:03:00.000Z"),
        },
      }),
      makeActivityEntry({
        id: "latest-complete",
        created_at: new Date("2026-03-23T12:05:00.000Z"),
        event_type: "scan.completed",
        metadata: {
          scanId: "scan_latest",
          repo: "acme/latest",
          timestamp: new Date("2026-03-23T12:05:00.000Z"),
          durationMs: 120000,
          totalFindings: 0,
          totalPrs: 0,
        },
      }),
    ]);

    expect(scans.map((scan) => scan.scanId)).toEqual([
      "scan_latest",
      "scan_started_only",
      "scan_pr_only",
    ]);

    expect(scans).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ scanId: "scan_unknown" })]),
    );
    expect(scans[2]).toMatchObject({
      scanId: "scan_pr_only",
      repo: "acme/pr-only",
      startedAt: undefined,
      completedAt: undefined,
      prUrls: ["https://github.com/acme/pr-only/pull/9"],
      botsRun: ["evidence-capture"],
    });
  });

  it("adds a bot to botsRun when a valid finding arrives before bot completion metadata", () => {
    const scans = buildScansFromActivity([
      makeActivityEntry({
        id: "start",
        event_type: "scan.started",
        metadata: {
          scanId: "scan_findings_first",
          repo: "acme/findings-first",
          timestamp: new Date("2026-03-23T12:00:00.000Z"),
        },
      }),
      makeActivityEntry({
        id: "finding",
        created_at: new Date("2026-03-23T12:01:00.000Z"),
        event_type: "bot.finding",
        metadata: {
          scanId: "scan_findings_first",
          botName: "secret-detector",
          finding: {
            file: "src/secrets.ts",
            severity: "medium",
            category: "secrets",
            description: "Hard-coded credential found",
          },
        },
      }),
    ]);

    expect(scans).toEqual([
      expect.objectContaining({
        scanId: "scan_findings_first",
        repo: "acme/findings-first",
        botsRun: ["secret-detector"],
        findingEvents: [
          expect.objectContaining({
            botName: "secret-detector",
            severity: "medium",
            description: "Hard-coded credential found",
          }),
        ],
      }),
    ]);
  });

  it("ignores bot.finding events whose finding payload is not an object", () => {
    const scans = buildScansFromActivity([
      makeActivityEntry({
        id: "start",
        event_type: "scan.started",
        metadata: {
          scanId: "scan_invalid_finding_shape",
          repo: "acme/invalid-finding-shape",
          timestamp: new Date("2026-03-23T12:00:00.000Z"),
        },
      }),
      makeActivityEntry({
        id: "invalid-finding-shape",
        created_at: new Date("2026-03-23T12:01:00.000Z"),
        event_type: "bot.finding",
        metadata: {
          scanId: "scan_invalid_finding_shape",
          botName: "security-scanner",
          finding: null,
        },
      }),
    ]);

    expect(scans).toEqual([
      expect.objectContaining({
        scanId: "scan_invalid_finding_shape",
        findingEvents: [],
        botsRun: [],
      }),
    ]);
  });

  it("adds a completed bot to botsRun when completion arrives before any other bot metadata", () => {
    const scans = buildScansFromActivity([
      makeActivityEntry({
        id: "start",
        event_type: "scan.started",
        metadata: {
          scanId: "scan_bot_completed",
          repo: "acme/completion-first",
          timestamp: new Date("2026-03-23T12:00:00.000Z"),
        },
      }),
      makeActivityEntry({
        id: "bot-complete",
        created_at: new Date("2026-03-23T12:01:00.000Z"),
        event_type: "bot.completed",
        metadata: {
          scanId: "scan_bot_completed",
          botName: "actions-hardening",
          findingCount: 0,
          durationMs: 450,
        },
      }),
    ]);

    expect(scans).toEqual([
      expect.objectContaining({
        scanId: "scan_bot_completed",
        repo: "acme/completion-first",
        botsRun: ["actions-hardening"],
        botResults: {
          "actions-hardening": {
            findingCount: 0,
            durationMs: 450,
          },
        },
      }),
    ]);
  });

  it("fills in repo and remediation artifacts from pr.created metadata", () => {
    const scans = buildScansFromActivity([
      makeActivityEntry({
        id: "start-without-repo",
        event_type: "scan.started",
        metadata: {
          scanId: "scan_pr_metadata",
          timestamp: new Date("2026-03-23T12:00:00.000Z"),
        },
      }),
      makeActivityEntry({
        id: "pr-created",
        created_at: new Date("2026-03-23T12:01:00.000Z"),
        event_type: "pr.created",
        metadata: {
          scanId: "scan_pr_metadata",
          repo: "acme/pr-metadata",
          prUrl: "https://github.com/acme/pr-metadata/pull/7",
        },
      }),
    ]);

    expect(scans).toEqual([
      expect.objectContaining({
        scanId: "scan_pr_metadata",
        repo: "acme/pr-metadata",
        prUrls: ["https://github.com/acme/pr-metadata/pull/7"],
      }),
    ]);
  });

  it("leaves remediation artifacts empty when pr.created omits the pr url", () => {
    const scans = buildScansFromActivity([
      makeActivityEntry({
        id: "start",
        event_type: "scan.started",
        metadata: {
          scanId: "scan_without_pr_url",
          repo: "acme/no-pr-url",
          timestamp: new Date("2026-03-23T12:00:00.000Z"),
        },
      }),
      makeActivityEntry({
        id: "pr-created-without-url",
        created_at: new Date("2026-03-23T12:01:00.000Z"),
        event_type: "pr.created",
        metadata: {
          scanId: "scan_without_pr_url",
          repo: "acme/no-pr-url",
        },
      }),
    ]);

    expect(scans).toEqual([
      expect.objectContaining({
        scanId: "scan_without_pr_url",
        prUrls: [],
      }),
    ]);
  });

  it("preserves existing completed totals when scan.completed carries malformed numeric fields", () => {
    const scans = buildScansFromActivity([
      makeActivityEntry({
        id: "start",
        event_type: "scan.started",
        metadata: {
          scanId: "scan_bad_totals",
          repo: "acme/bad-totals",
          timestamp: new Date("2026-03-23T12:00:00.000Z"),
        },
      }),
      makeActivityEntry({
        id: "complete-valid",
        created_at: new Date("2026-03-23T12:05:00.000Z"),
        event_type: "scan.completed",
        metadata: {
          scanId: "scan_bad_totals",
          repo: "acme/bad-totals",
          timestamp: new Date("2026-03-23T12:05:00.000Z"),
          totalFindings: 4,
          totalPrs: 2,
        },
      }),
      makeActivityEntry({
        id: "complete-malformed",
        created_at: new Date("2026-03-23T12:06:00.000Z"),
        event_type: "scan.completed",
        metadata: {
          scanId: "scan_bad_totals",
          repo: "acme/bad-totals",
          timestamp: new Date("2026-03-23T12:06:00.000Z"),
          totalFindings: "four",
          totalPrs: null,
        },
      }),
    ]);

    expect(scans).toEqual([
      expect.objectContaining({
        scanId: "scan_bad_totals",
        totalFindings: 4,
        totalPrs: 2,
        completedAt: "2026-03-23T12:06:00.000Z",
      }),
    ]);
  });

  it("ignores nullish metadata and falls back to created_at timestamps while preserving remediation urls", () => {
    const scans = buildScansFromActivity([
      makeActivityEntry({
        id: "null-metadata",
        created_at: new Date("2026-03-23T11:59:00.000Z"),
        event_type: "scan.started",
        metadata: null,
      }),
      makeActivityEntry({
        id: "started-with-created-at",
        created_at: new Date("2026-03-23T12:00:00.000Z"),
        event_type: "scan.started",
        metadata: {
          scanId: "scan_timestamp_fallback",
          repo: "acme/timestamp-fallback",
        },
      }),
      makeActivityEntry({
        id: "completed-with-created-at",
        created_at: new Date("2026-03-23T12:05:00.000Z"),
        event_type: "scan.completed",
        metadata: {
          scanId: "scan_timestamp_fallback",
          repo: "acme/timestamp-fallback",
          findings: [
            {
              bot: "security-scanner",
              findingCount: 1,
              prUrl: "https://github.com/acme/timestamp-fallback/pull/12",
            },
          ],
        },
      }),
    ]);

    expect(scans).toEqual([
      expect.objectContaining({
        scanId: "scan_timestamp_fallback",
        repo: "acme/timestamp-fallback",
        startedAt: "2026-03-23T12:00:00.000Z",
        completedAt: "2026-03-23T12:05:00.000Z",
        prUrls: ["https://github.com/acme/timestamp-fallback/pull/12"],
        botResults: {
          "security-scanner": {
            findingCount: 1,
          },
        },
      }),
    ]);
  });

  it("uses created_at when scan.started omits metadata.timestamp", () => {
    const scans = buildScansFromActivity([
      makeActivityEntry({
        id: "start-with-created-at",
        created_at: new Date("2026-03-23T12:00:00.000Z"),
        event_type: "scan.started",
        metadata: {
          scanId: "scan_started_timestamp_fallback",
          repo: "acme/started-fallback",
        },
      }),
    ]);

    expect(scans).toEqual([
      expect.objectContaining({
        scanId: "scan_started_timestamp_fallback",
        startedAt: "2026-03-23T12:00:00.000Z",
      }),
    ]);
  });

  it("preserves a non-empty string metadata timestamp during scan reconstruction", () => {
    const scans = buildScansFromActivity([
      makeActivityEntry({
        id: "start-with-string-timestamp",
        created_at: new Date("2026-03-23T12:00:00.000Z"),
        event_type: "scan.started",
        metadata: {
          scanId: "scan_string_timestamp",
          repo: "acme/string-timestamp",
          timestamp: "2026-03-22T09:30:00.000Z",
        },
      }),
    ]);

    expect(scans).toEqual([
      expect.objectContaining({
        scanId: "scan_string_timestamp",
        startedAt: "2026-03-22T09:30:00.000Z",
      }),
    ]);
  });

  it("uses created_at when scan.completed omits metadata.timestamp", () => {
    const scans = buildScansFromActivity([
      makeActivityEntry({
        id: "start",
        created_at: new Date("2026-03-23T12:00:00.000Z"),
        event_type: "scan.started",
        metadata: {
          scanId: "scan_completed_timestamp_fallback",
          repo: "acme/completed-fallback",
          timestamp: new Date("2026-03-23T12:00:00.000Z"),
        },
      }),
      makeActivityEntry({
        id: "completed-with-created-at",
        created_at: new Date("2026-03-23T12:05:00.000Z"),
        event_type: "scan.completed",
        metadata: {
          scanId: "scan_completed_timestamp_fallback",
          repo: "acme/completed-fallback",
        },
      }),
    ]);

    expect(scans).toEqual([
      expect.objectContaining({
        scanId: "scan_completed_timestamp_fallback",
        completedAt: "2026-03-23T12:05:00.000Z",
      }),
    ]);
  });

  it("orders scans correctly when the right-hand comparator scan falls back to startedAt", () => {
    const scans = buildScansFromActivity([
      makeActivityEntry({
        id: "latest-start",
        created_at: new Date("2026-03-23T12:00:00.000Z"),
        event_type: "scan.started",
        metadata: {
          scanId: "scan_completed",
          repo: "acme/completed",
          timestamp: new Date("2026-03-23T12:00:00.000Z"),
        },
      }),
      makeActivityEntry({
        id: "started-only",
        created_at: new Date("2026-03-23T12:01:00.000Z"),
        event_type: "scan.started",
        metadata: {
          scanId: "scan_started_only_rhs",
          repo: "acme/started-only",
          timestamp: new Date("2026-03-23T12:01:00.000Z"),
        },
      }),
      makeActivityEntry({
        id: "latest-complete",
        created_at: new Date("2026-03-23T12:05:00.000Z"),
        event_type: "scan.completed",
        metadata: {
          scanId: "scan_completed",
          repo: "acme/completed",
          timestamp: new Date("2026-03-23T12:05:00.000Z"),
          totalFindings: 0,
          totalPrs: 0,
        },
      }),
    ]);

    expect(scans.map((scan) => scan.scanId)).toEqual([
      "scan_completed",
      "scan_started_only_rhs",
    ]);
  });

  it("ignores bot.completed without a bot name and defaults malformed bot metrics", () => {
    const scans = buildScansFromActivity([
      makeActivityEntry({
        id: "start",
        event_type: "scan.started",
        metadata: {
          scanId: "scan_bot_defaults",
          repo: "acme/bot-defaults",
          timestamp: new Date("2026-03-23T12:00:00.000Z"),
        },
      }),
      makeActivityEntry({
        id: "missing-name",
        created_at: new Date("2026-03-23T12:01:00.000Z"),
        event_type: "bot.completed",
        metadata: {
          scanId: "scan_bot_defaults",
          findingCount: 99,
          durationMs: 1000,
        },
      }),
      makeActivityEntry({
        id: "malformed-metrics",
        created_at: new Date("2026-03-23T12:02:00.000Z"),
        event_type: "bot.completed",
        metadata: {
          scanId: "scan_bot_defaults",
          botName: "secrets-detector",
          findingCount: "bad",
          durationMs: "slow",
        },
      }),
    ]);

    expect(scans).toEqual([
      expect.objectContaining({
        scanId: "scan_bot_defaults",
        botsRun: ["secrets-detector"],
        botResults: {
          "secrets-detector": {
            findingCount: 0,
            durationMs: undefined,
          },
        },
      }),
    ]);
  });

  it("syncs engineering controls in pages and keeps integration-status failures non-fatal", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ session_id: "session_1" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ accepted: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ accepted: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ closed: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response("temporary status failure", { status: 503 }));

    vi.stubGlobal("fetch", fetchMock);

    const client = new SprintoPushClient({
      apiKey: "sprinto-key",
      baseUrl: "https://sprinto.test",
    });

    const entities = Array.from({ length: 101 }, (_, index) => makeEntity(index + 1));
    const result = await client.syncEngineeringControls({
      integrationId: "integration_1",
      entities,
    });

    expect(result).toEqual({
      sessionId: "session_1",
      pushedPages: 2,
      pushedEntities: 101,
      closeResponse: { closed: true },
      integrationStatus: undefined,
    });

    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://sprinto.test/v1/integrations/integration_1/sessions/session_1/entities",
    );

    const firstPageBody = JSON.parse(
      fetchMock.mock.calls[1]?.[1]?.body as string,
    ) as {
      page_hint: string;
      entities: Record<string, SprintoControlEntity[]>;
    };
    const secondPageBody = JSON.parse(
      fetchMock.mock.calls[2]?.[1]?.body as string,
    ) as {
      page_hint: string;
      entities: Record<string, SprintoControlEntity[]>;
    };

    expect(firstPageBody.page_hint).toBe("page-1");
    expect(firstPageBody.entities.engineering_controls).toHaveLength(100);
    expect(secondPageBody.page_hint).toBe("page-2");
    expect(secondPageBody.entities.engineering_controls).toHaveLength(1);
  });

  it("uses the default Sprinto base URL and default entity type when callers omit both", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ accepted: true }), { status: 200 }));

    vi.stubGlobal("fetch", fetchMock);

    const client = new SprintoPushClient({
      apiKey: "sprinto-key",
    });

    await client.getIntegrationStatus("integration_1");
    await client.pushEntityPage("integration_1", "session_1", "", [makeEntity(1)], "page-1");

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://api.sprinto.com/api/external/push/v1/integrations/integration_1/status",
    );

    const pushBody = JSON.parse(fetchMock.mock.calls[1]?.[1]?.body as string) as {
      page_hint: string;
      entities: Record<string, SprintoControlEntity[]>;
    };

    expect(pushBody.page_hint).toBe("page-1");
    expect(pushBody.entities.engineering_controls).toHaveLength(1);
  });

  it("fails fast when Sprinto cannot create a valid session or rejects an entity push", async () => {
    const missingSessionFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));
    vi.stubGlobal("fetch", missingSessionFetch);

    const client = new SprintoPushClient({
      apiKey: "sprinto-key",
      baseUrl: "https://sprinto.test",
    });

    await expect(client.createSession("integration_1")).rejects.toThrow(
      "Sprinto session response did not include a session id",
    );

    const rejectedPushFetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "session_2" }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response("push rejected", { status: 422 }));

    vi.stubGlobal("fetch", rejectedPushFetch);

    await expect(
      client.syncEngineeringControls({
        integrationId: "integration_1",
        entities: [makeEntity(1)],
      }),
    ).rejects.toThrow("Sprinto API request failed (422): push rejected");
  });

  it("falls back to the HTTP status text when Sprinto returns an empty error body", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("", { status: 502, statusText: "Bad Gateway" }));

    vi.stubGlobal("fetch", fetchMock);

    const client = new SprintoPushClient({
      apiKey: "sprinto-key",
      baseUrl: "https://sprinto.test",
    });

    await expect(client.getIntegrationStatus("integration_1")).rejects.toThrow(
      "Sprinto API request failed (502): Bad Gateway",
    );
  });
});
