import type {
  SprintoExceptionState,
  SprintoMonitoringStatus,
  SprintoExportState,
} from "@/lib/compliance/sprinto";
import {
  getSprintoControlBaselines,
  insertSprintoMonitoringFindings,
  insertSprintoMonitoringRun,
  replaceSprintoControlBaselines,
} from "./queries/sprinto-monitoring";

export type SprintoControlBaselineRow = {
  org_id: string;
  external_id: string;
  control_key: string;
  repo: string;
  monitoring_status: SprintoMonitoringStatus;
  exception_state: SprintoExceptionState;
  sprinto_export_state: SprintoExportState;
  summary: string;
  synced_at: string;
};

export type SprintoMonitoringRunRow = {
  id: string;
  org_id: string;
  checked_at: string;
  controls_checked: number;
  stale_controls: number;
  open_exceptions: number;
  findings_count: number;
};

export type SprintoMonitoringFindingType =
  | "stale-control"
  | "exception-opened"
  | "exception-changed"
  | "exception-resolved"
  | "export-state-changed"
  | "monitoring-regressed";

export type SprintoMonitoringFindingSeverity = "low" | "medium" | "high";

export type SprintoMonitoringFindingRow = {
  id: string;
  run_id: string;
  org_id: string;
  external_id: string;
  control_key: string;
  repo: string;
  finding_type: SprintoMonitoringFindingType;
  severity: SprintoMonitoringFindingSeverity;
  detail: string;
  previous_monitoring_status: SprintoMonitoringStatus | null;
  current_monitoring_status: SprintoMonitoringStatus;
  previous_exception_state: SprintoExceptionState | null;
  current_exception_state: SprintoExceptionState;
  previous_export_state: SprintoExportState | null;
  current_export_state: SprintoExportState;
  created_at: string;
};

type SprintoMonitoringStore = {
  baselinesByOrg: Map<string, SprintoControlBaselineRow[]>;
  runsByOrg: Map<string, SprintoMonitoringRunRow[]>;
  findingsByOrg: Map<string, SprintoMonitoringFindingRow[]>;
};

const STORE_KEY = "__nanobotsSprintoMonitoringStore";

function cloneBaselines(
  rows: SprintoControlBaselineRow[],
): SprintoControlBaselineRow[] {
  return rows.map((row) => ({ ...row }));
}

function cloneRuns(rows: SprintoMonitoringRunRow[]): SprintoMonitoringRunRow[] {
  return rows.map((row) => ({ ...row }));
}

function cloneFindings(
  rows: SprintoMonitoringFindingRow[],
): SprintoMonitoringFindingRow[] {
  return rows.map((row) => ({ ...row }));
}

function getMonitoringStore(): SprintoMonitoringStore {
  const g = globalThis as typeof globalThis & {
    [STORE_KEY]?: SprintoMonitoringStore;
  };

  if (!g[STORE_KEY]) {
    g[STORE_KEY] = {
      baselinesByOrg: new Map(),
      runsByOrg: new Map(),
      findingsByOrg: new Map(),
    };
  }

  return g[STORE_KEY];
}

export function resetSprintoMonitoringStore(): void {
  const g = globalThis as typeof globalThis & {
    [STORE_KEY]?: SprintoMonitoringStore;
  };
  g[STORE_KEY] = {
    baselinesByOrg: new Map(),
    runsByOrg: new Map(),
    findingsByOrg: new Map(),
  };
}

export function seedSprintoControlBaselines(
  orgId: string,
  rows: SprintoControlBaselineRow[],
): void {
  getMonitoringStore().baselinesByOrg.set(orgId, cloneBaselines(rows));
}

export function listSprintoMonitoringRunsSync(
  orgId: string,
): SprintoMonitoringRunRow[] {
  return cloneRuns(getMonitoringStore().runsByOrg.get(orgId) ?? []);
}

export function listSprintoMonitoringFindingsSync(
  orgId: string,
): SprintoMonitoringFindingRow[] {
  return cloneFindings(getMonitoringStore().findingsByOrg.get(orgId) ?? []);
}

export async function loadSprintoControlBaselinesFromDb(
  orgId: string,
): Promise<SprintoControlBaselineRow[]> {
  const cached = getMonitoringStore().baselinesByOrg.get(orgId);
  if (cached) {
    return cloneBaselines(cached);
  }

  try {
    const rows = await getSprintoControlBaselines(orgId);
    getMonitoringStore().baselinesByOrg.set(orgId, cloneBaselines(rows));
    return cloneBaselines(rows);
  } catch {
    return [];
  }
}

export async function saveSprintoControlBaselinesToDb(
  orgId: string,
  rows: SprintoControlBaselineRow[],
): Promise<void> {
  getMonitoringStore().baselinesByOrg.set(orgId, cloneBaselines(rows));

  try {
    await replaceSprintoControlBaselines(orgId, rows);
  } catch {
    // Preserve the in-memory baseline when DB persistence is unavailable.
  }
}

export async function recordSprintoMonitoringRunToDb(
  orgId: string,
  run: SprintoMonitoringRunRow,
  findings: SprintoMonitoringFindingRow[],
): Promise<void> {
  const store = getMonitoringStore();
  store.runsByOrg.set(orgId, [...(store.runsByOrg.get(orgId) ?? []), { ...run }]);
  store.findingsByOrg.set(orgId, [
    ...(store.findingsByOrg.get(orgId) ?? []),
    ...cloneFindings(findings),
  ]);

  try {
    await insertSprintoMonitoringRun(run);
    await insertSprintoMonitoringFindings(findings);
  } catch {
    // Monitoring results stay queryable from the durable process store.
  }
}
