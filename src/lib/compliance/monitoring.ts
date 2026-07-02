import type {
  SprintoControlEntity,
  SprintoExceptionState,
  SprintoMonitoringStatus,
} from "@/lib/compliance/sprinto";
import {
  loadSprintoControlBaselinesFromDb,
  recordSprintoMonitoringRunToDb,
  saveSprintoControlBaselinesToDb,
  type SprintoControlBaselineRow,
  type SprintoMonitoringFindingRow,
  type SprintoMonitoringFindingSeverity,
  type SprintoMonitoringFindingType,
  type SprintoMonitoringRunRow,
} from "@/lib/db/monitoring";

export type SprintoMonitoringRunResult = {
  run: SprintoMonitoringRunRow;
  findings: SprintoMonitoringFindingRow[];
  comparedBaselineControls: number;
};

function formatTimestamp(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function createMonitoringId(prefix: string, timestamp: string, index = 0): string {
  return `${prefix}_${timestamp.replace(/[^\d]/g, "").slice(0, 14)}_${index}`;
}

function describeExceptionState(state: SprintoExceptionState): string {
  switch (state) {
    case "none":
      return "no open exception";
    case "open":
      return "an open exception";
    case "remediating":
      return "a remediating exception";
    case "missing_data":
      return "missing supporting data";
  }
}

function monitoringRank(status: SprintoMonitoringStatus): number {
  switch (status) {
    case "healthy":
      return 0;
    case "needs_attention":
      return 1;
    case "stale":
      return 2;
    case "not_scanned":
      return 3;
  }
}

function isMonitoringRegression(
  previous: SprintoMonitoringStatus,
  current: SprintoMonitoringStatus,
): boolean {
  return monitoringRank(current) > monitoringRank(previous);
}

function severityForException(state: SprintoExceptionState): SprintoMonitoringFindingSeverity {
  switch (state) {
    case "open":
      return "high";
    case "missing_data":
      return "high";
    case "remediating":
      return "medium";
    case "none":
      return "low";
  }
}

function buildFinding(
  runId: string,
  orgId: string,
  checkedAt: string,
  index: number,
  entity: SprintoControlEntity,
  previous: SprintoControlBaselineRow | undefined,
  findingType: SprintoMonitoringFindingType,
  severity: SprintoMonitoringFindingSeverity,
  detail: string,
): SprintoMonitoringFindingRow {
  return {
    id: createMonitoringId("finding", checkedAt, index),
    run_id: runId,
    org_id: orgId,
    external_id: entity.external_id,
    control_key: entity.control_key,
    repo: entity.repo,
    finding_type: findingType,
    severity,
    detail,
    previous_monitoring_status: previous?.monitoring_status ?? null,
    current_monitoring_status: entity.monitoring_status,
    previous_exception_state: previous?.exception_state ?? null,
    current_exception_state: entity.exception_state,
    previous_export_state: previous?.sprinto_export_state ?? null,
    current_export_state: entity.sprinto_export_state,
    created_at: checkedAt,
  };
}

function buildControlFindings(
  runId: string,
  orgId: string,
  checkedAt: string,
  startIndex: number,
  entity: SprintoControlEntity,
  previous: SprintoControlBaselineRow | undefined,
): SprintoMonitoringFindingRow[] {
  const findings: SprintoMonitoringFindingRow[] = [];
  let findingIndex = startIndex;

  if (entity.monitoring_status === "stale") {
    findings.push(
      buildFinding(
        runId,
        orgId,
        checkedAt,
        findingIndex,
        entity,
        previous,
        "stale-control",
        "high",
        `${entity.control_key} for ${entity.repo} is stale and needs fresh evidence before the Sprinto view can be trusted.`,
      ),
    );
    findingIndex += 1;
  }

  if (previous && isMonitoringRegression(previous.monitoring_status, entity.monitoring_status)) {
    findings.push(
      buildFinding(
        runId,
        orgId,
        checkedAt,
        findingIndex,
        entity,
        previous,
        "monitoring-regressed",
        entity.monitoring_status === "stale" ? "high" : "medium",
        `${entity.control_key} regressed from ${previous.monitoring_status} to ${entity.monitoring_status} since the last Sprinto sync baseline.`,
      ),
    );
    findingIndex += 1;
  }

  if (previous && previous.exception_state !== entity.exception_state) {
    const findingType =
      entity.exception_state === "none"
        ? "exception-resolved"
        : previous.exception_state === "none"
          ? "exception-opened"
          : "exception-changed";
    const detail =
      entity.exception_state === "none"
        ? `${entity.control_key} on ${entity.repo} resolved ${describeExceptionState(previous.exception_state)} since the last Sprinto sync baseline.`
        : `${entity.control_key} on ${entity.repo} moved from ${describeExceptionState(previous.exception_state)} to ${describeExceptionState(entity.exception_state)}.`;

    findings.push(
      buildFinding(
        runId,
        orgId,
        checkedAt,
        findingIndex,
        entity,
        previous,
        findingType,
        severityForException(entity.exception_state),
        detail,
      ),
    );
    findingIndex += 1;
  }

  if (
    previous &&
    previous.sprinto_export_state !== entity.sprinto_export_state
  ) {
    findings.push(
      buildFinding(
        runId,
        orgId,
        checkedAt,
        findingIndex,
        entity,
        previous,
        "export-state-changed",
        entity.sprinto_export_state === "ready" ? "low" : "medium",
        `${entity.control_key} export state changed from ${previous.sprinto_export_state} to ${entity.sprinto_export_state}.`,
      ),
    );
  }

  return findings;
}

function toBaselineRows(
  orgId: string,
  entities: SprintoControlEntity[],
  syncedAt: string,
): SprintoControlBaselineRow[] {
  return entities.map((entity) => ({
    org_id: orgId,
    external_id: entity.external_id,
    control_key: entity.control_key,
    repo: entity.repo,
    monitoring_status: entity.monitoring_status,
    exception_state: entity.exception_state,
    sprinto_export_state: entity.sprinto_export_state,
    summary: entity.summary,
    synced_at: syncedAt,
  }));
}

export async function recordSprintoExportBaseline(params: {
  orgId: string;
  entities: SprintoControlEntity[];
  syncedAt?: Date | string;
}): Promise<SprintoControlBaselineRow[]> {
  const syncedAt = formatTimestamp(params.syncedAt ?? new Date());
  const rows = toBaselineRows(params.orgId, params.entities, syncedAt);
  await saveSprintoControlBaselinesToDb(params.orgId, rows);
  return rows;
}

export async function runSprintoMonitoringLoop(params: {
  orgId: string;
  currentEntities: SprintoControlEntity[];
  checkedAt?: Date | string;
}): Promise<SprintoMonitoringRunResult> {
  const checkedAt = formatTimestamp(params.checkedAt ?? new Date());
  const previousBaselines = await loadSprintoControlBaselinesFromDb(params.orgId);
  const baselineByExternalId = new Map(
    previousBaselines.map((row) => [row.external_id, row]),
  );

  const findings: SprintoMonitoringFindingRow[] = [];
  for (const entity of params.currentEntities) {
    findings.push(
      ...buildControlFindings(
        createMonitoringId("run", checkedAt),
        params.orgId,
        checkedAt,
        findings.length,
        entity,
        baselineByExternalId.get(entity.external_id),
      ),
    );
  }

  const run: SprintoMonitoringRunRow = {
    id: createMonitoringId("run", checkedAt),
    org_id: params.orgId,
    checked_at: checkedAt,
    controls_checked: params.currentEntities.length,
    stale_controls: params.currentEntities.filter(
      (entity) => entity.monitoring_status === "stale",
    ).length,
    open_exceptions: params.currentEntities.filter(
      (entity) => entity.exception_state !== "none",
    ).length,
    findings_count: findings.length,
  };

  await recordSprintoMonitoringRunToDb(params.orgId, run, findings);

  return {
    run,
    findings,
    comparedBaselineControls: previousBaselines.length,
  };
}
