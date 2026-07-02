import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const durableMonitoringDb = {
  baselines: new Map<string, Array<Record<string, unknown>>>(),
  runs: [] as Array<Record<string, unknown>>,
  findings: [] as Array<Record<string, unknown>>,
  failGet: false,
  failReplace: false,
  failInsertRun: false,
  failInsertFindings: false,
};

vi.mock("@/lib/db/queries/sprinto-monitoring", () => ({
  getSprintoControlBaselines: vi.fn(async (orgId: string) => {
    if (durableMonitoringDb.failGet) {
      throw new Error("baselines unavailable");
    }

    return durableMonitoringDb.baselines.get(orgId) ?? [];
  }),
  replaceSprintoControlBaselines: vi.fn(
    async (orgId: string, rows: Array<Record<string, unknown>>) => {
      if (durableMonitoringDb.failReplace) {
        throw new Error("replace unavailable");
      }

      durableMonitoringDb.baselines.set(orgId, rows.map((row) => ({ ...row })));
    },
  ),
  insertSprintoMonitoringRun: vi.fn(async (row: Record<string, unknown>) => {
    if (durableMonitoringDb.failInsertRun) {
      throw new Error("run unavailable");
    }

    durableMonitoringDb.runs.push({ ...row });
  }),
  insertSprintoMonitoringFindings: vi.fn(
    async (rows: Array<Record<string, unknown>>) => {
      if (durableMonitoringDb.failInsertFindings) {
        throw new Error("findings unavailable");
      }

      durableMonitoringDb.findings.push(
        ...rows.map((row) => ({ ...row })),
      );
    },
  ),
}));

import type { SprintoControlEntity } from "@/lib/compliance/sprinto";
import {
  recordSprintoExportBaseline,
  runSprintoMonitoringLoop,
} from "@/lib/compliance/monitoring";
import {
  listSprintoMonitoringFindingsSync,
  listSprintoMonitoringRunsSync,
  loadSprintoControlBaselinesFromDb,
  resetSprintoMonitoringStore,
  saveSprintoControlBaselinesToDb,
  seedSprintoControlBaselines,
  recordSprintoMonitoringRunToDb,
} from "@/lib/db/monitoring";

function makeEntity(
  controlKey: string,
  overrides: Partial<SprintoControlEntity> = {},
): SprintoControlEntity {
  return {
    external_id: `scan_1:${controlKey}`,
    repo: "acme/api",
    scan_id: "scan_1",
    control_key: controlKey,
    control_name: `Control ${controlKey}`,
    suggested_soc2_mapping: "CC8.1",
    status: "pass",
    finding_count: 0,
    highest_severity: "none",
    remediation_count: 0,
    bots_csv: "security-scanner",
    remediation_urls_csv: "",
    scan_started_at: "2026-03-26T08:55:00.000Z",
    scan_completed_at: "2026-03-26T09:15:00.000Z",
    summary: `${controlKey} summary`,
    evidence_markdown: "# evidence",
    sample_findings_json: "[]",
    monitoring_status: "healthy",
    exception_state: "none",
    sprinto_export_state: "ready",
    ...overrides,
  };
}

describe("sprinto monitoring loop contract", () => {
  beforeEach(() => {
    durableMonitoringDb.baselines.clear();
    durableMonitoringDb.runs = [];
    durableMonitoringDb.findings = [];
    durableMonitoringDb.failGet = false;
    durableMonitoringDb.failReplace = false;
    durableMonitoringDb.failInsertRun = false;
    durableMonitoringDb.failInsertFindings = false;
    resetSprintoMonitoringStore();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    resetSprintoMonitoringStore();
  });

  it("returns empty monitoring history when an org has no persisted runs or findings", () => {
    expect(listSprintoMonitoringRunsSync("org-empty")).toEqual([]);
    expect(listSprintoMonitoringFindingsSync("org-empty")).toEqual([]);
  });

  it("persists export baselines and reloads them from the cached store", async () => {
    const rows = await recordSprintoExportBaseline({
      orgId: "org-cache",
      entities: [makeEntity("NB-CC-001")],
      syncedAt: new Date("2026-03-26T09:15:00.000Z"),
    });

    expect(rows).toEqual([
      expect.objectContaining({
        org_id: "org-cache",
        external_id: "scan_1:NB-CC-001",
        synced_at: "2026-03-26T09:15:00.000Z",
      }),
    ]);

    await expect(loadSprintoControlBaselinesFromDb("org-cache")).resolves.toEqual(
      rows,
    );
    expect(durableMonitoringDb.baselines.get("org-cache")).toEqual(rows);
  });

  it("falls back to the in-memory baseline store when baseline persistence fails", async () => {
    durableMonitoringDb.failReplace = true;

    await saveSprintoControlBaselinesToDb("org-fallback", [
      {
        org_id: "org-fallback",
        external_id: "scan_1:NB-CC-001",
        control_key: "NB-CC-001",
        repo: "acme/api",
        monitoring_status: "healthy",
        exception_state: "none",
        sprinto_export_state: "ready",
        summary: "baseline",
        synced_at: "2026-03-26T09:15:00.000Z",
      },
    ]);

    await expect(
      loadSprintoControlBaselinesFromDb("org-fallback"),
    ).resolves.toEqual([
      expect.objectContaining({
        external_id: "scan_1:NB-CC-001",
      }),
    ]);
    expect(durableMonitoringDb.baselines.get("org-fallback")).toBeUndefined();
  });

  it("loads baselines from the durable query seam after process cache loss", async () => {
    durableMonitoringDb.baselines.set("org-durable", [
      {
        org_id: "org-durable",
        external_id: "scan_1:NB-CC-001",
        control_key: "NB-CC-001",
        repo: "acme/api",
        monitoring_status: "healthy",
        exception_state: "none",
        sprinto_export_state: "ready",
        summary: "durable",
        synced_at: "2026-03-26T09:15:00.000Z",
      },
    ]);

    resetSprintoMonitoringStore();

    await expect(loadSprintoControlBaselinesFromDb("org-durable")).resolves.toEqual(
      [
        expect.objectContaining({
          summary: "durable",
        }),
      ],
    );
  });

  it("returns an empty baseline set when both cache and durable lookup are unavailable", async () => {
    durableMonitoringDb.failGet = true;

    await expect(loadSprintoControlBaselinesFromDb("org-missing")).resolves.toEqual(
      [],
    );
  });

  it("writes monitoring findings for stale controls, regressions, opened exceptions, and export changes", async () => {
    await recordSprintoExportBaseline({
      orgId: "org-loop",
      entities: [makeEntity("NB-CC-002"), makeEntity("NB-CC-003")],
      syncedAt: "2026-03-26T09:15:00.000Z",
    });

    const result = await runSprintoMonitoringLoop({
      orgId: "org-loop",
      checkedAt: "2026-03-29T12:00:00.000Z",
      currentEntities: [
        makeEntity("NB-CC-002", {
          monitoring_status: "stale",
          exception_state: "open",
          sprinto_export_state: "action_required",
        }),
        makeEntity("NB-CC-003", {
          monitoring_status: "not_scanned",
          exception_state: "missing_data",
          sprinto_export_state: "blocked",
        }),
      ],
    });

    expect(result.run).toEqual({
      id: "run_20260329120000_0",
      org_id: "org-loop",
      checked_at: "2026-03-29T12:00:00.000Z",
      controls_checked: 2,
      stale_controls: 1,
      open_exceptions: 2,
      findings_count: 7,
    });
    expect(result.comparedBaselineControls).toBe(2);
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          finding_type: "stale-control",
          severity: "high",
          control_key: "NB-CC-002",
        }),
        expect.objectContaining({
          finding_type: "monitoring-regressed",
          current_monitoring_status: "stale",
        }),
        expect.objectContaining({
          finding_type: "exception-opened",
          current_exception_state: "open",
          severity: "high",
        }),
        expect.objectContaining({
          finding_type: "export-state-changed",
          current_export_state: "action_required",
          severity: "medium",
        }),
        expect.objectContaining({
          finding_type: "monitoring-regressed",
          current_monitoring_status: "not_scanned",
        }),
        expect.objectContaining({
          finding_type: "exception-opened",
          current_exception_state: "missing_data",
        }),
        expect.objectContaining({
          finding_type: "export-state-changed",
          current_export_state: "blocked",
        }),
      ]),
    );
    expect(listSprintoMonitoringRunsSync("org-loop")).toEqual([result.run]);
    expect(listSprintoMonitoringFindingsSync("org-loop")).toEqual(result.findings);
    expect(durableMonitoringDb.runs).toHaveLength(1);
    expect(durableMonitoringDb.findings).toHaveLength(7);
  });

  it("creates stale findings without a baseline and defaults the check timestamp to now", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-29T15:00:00.000Z"));

    const result = await runSprintoMonitoringLoop({
      orgId: "org-first-pass",
      currentEntities: [
        makeEntity("NB-CC-001", {
          monitoring_status: "stale",
        }),
      ],
    });

    expect(result.run.checked_at).toBe("2026-03-29T15:00:00.000Z");
    expect(result.comparedBaselineControls).toBe(0);
    expect(result.findings).toEqual([
      expect.objectContaining({
        finding_type: "stale-control",
        previous_monitoring_status: null,
        previous_exception_state: null,
        previous_export_state: null,
      }),
    ]);
  });

  it("records changed and resolved exceptions with the correct severities", async () => {
    seedSprintoControlBaselines("org-exceptions", [
      {
        org_id: "org-exceptions",
        external_id: "scan_1:NB-CC-004",
        control_key: "NB-CC-004",
        repo: "acme/api",
        monitoring_status: "needs_attention",
        exception_state: "open",
        sprinto_export_state: "action_required",
        summary: "old",
        synced_at: "2026-03-26T09:15:00.000Z",
      },
      {
        org_id: "org-exceptions",
        external_id: "scan_1:NB-CC-005",
        control_key: "NB-CC-005",
        repo: "acme/api",
        monitoring_status: "needs_attention",
        exception_state: "remediating",
        sprinto_export_state: "ready",
        summary: "old",
        synced_at: "2026-03-26T09:15:00.000Z",
      },
    ]);

    const result = await runSprintoMonitoringLoop({
      orgId: "org-exceptions",
      checkedAt: "2026-03-29T13:00:00.000Z",
      currentEntities: [
        makeEntity("NB-CC-004", {
          monitoring_status: "needs_attention",
          exception_state: "remediating",
          sprinto_export_state: "ready",
        }),
        makeEntity("NB-CC-005", {
          monitoring_status: "healthy",
          exception_state: "none",
          sprinto_export_state: "ready",
        }),
      ],
    });

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          finding_type: "exception-changed",
          severity: "medium",
          current_exception_state: "remediating",
        }),
        expect.objectContaining({
          finding_type: "exception-resolved",
          severity: "low",
          current_exception_state: "none",
        }),
        expect.objectContaining({
          finding_type: "export-state-changed",
          severity: "low",
          current_export_state: "ready",
        }),
      ]),
    );
  });

  it("still records runs and findings when durable monitoring inserts fail", async () => {
    durableMonitoringDb.failInsertRun = true;
    durableMonitoringDb.failInsertFindings = true;

    await recordSprintoMonitoringRunToDb(
      "org-write-fail",
      {
        id: "run_fail",
        org_id: "org-write-fail",
        checked_at: "2026-03-29T14:00:00.000Z",
        controls_checked: 1,
        stale_controls: 0,
        open_exceptions: 0,
        findings_count: 1,
      },
      [
        {
          id: "finding_fail",
          run_id: "run_fail",
          org_id: "org-write-fail",
          external_id: "scan_1:NB-CC-001",
          control_key: "NB-CC-001",
          repo: "acme/api",
          finding_type: "exception-resolved",
          severity: "low",
          detail: "resolved",
          previous_monitoring_status: "needs_attention",
          current_monitoring_status: "healthy",
          previous_exception_state: "remediating",
          current_exception_state: "none",
          previous_export_state: "ready",
          current_export_state: "ready",
          created_at: "2026-03-29T14:00:00.000Z",
        },
      ],
    );

    expect(listSprintoMonitoringRunsSync("org-write-fail")).toEqual([
      expect.objectContaining({ id: "run_fail" }),
    ]);
    expect(listSprintoMonitoringFindingsSync("org-write-fail")).toEqual([
      expect.objectContaining({ id: "finding_fail" }),
    ]);
    expect(durableMonitoringDb.runs).toHaveLength(0);
    expect(durableMonitoringDb.findings).toHaveLength(0);
  });
});
