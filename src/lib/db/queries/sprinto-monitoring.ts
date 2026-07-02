import { sql } from "../index";
import type {
  SprintoControlBaselineRow,
  SprintoMonitoringFindingRow,
  SprintoMonitoringRunRow,
} from "../monitoring";

export async function getSprintoControlBaselines(
  orgId: string,
): Promise<SprintoControlBaselineRow[]> {
  const { rows } = await sql<SprintoControlBaselineRow>`
    SELECT org_id, external_id, control_key, repo, monitoring_status,
           exception_state, sprinto_export_state, summary, synced_at
    FROM sprinto_control_baselines
    WHERE org_id = ${orgId}
    ORDER BY external_id ASC
  `;

  return rows;
}

export async function replaceSprintoControlBaselines(
  orgId: string,
  rows: SprintoControlBaselineRow[],
): Promise<void> {
  await sql`
    DELETE FROM sprinto_control_baselines
    WHERE org_id = ${orgId}
  `;

  for (const row of rows) {
    await sql`
      INSERT INTO sprinto_control_baselines (
        org_id, external_id, control_key, repo, monitoring_status,
        exception_state, sprinto_export_state, summary, synced_at
      ) VALUES (
        ${row.org_id}, ${row.external_id}, ${row.control_key}, ${row.repo},
        ${row.monitoring_status}, ${row.exception_state},
        ${row.sprinto_export_state}, ${row.summary}, ${row.synced_at}
      )
    `;
  }
}

export async function insertSprintoMonitoringRun(
  row: SprintoMonitoringRunRow,
): Promise<void> {
  await sql`
    INSERT INTO sprinto_monitoring_runs (
      id, org_id, checked_at, controls_checked, stale_controls,
      open_exceptions, findings_count
    ) VALUES (
      ${row.id}, ${row.org_id}, ${row.checked_at}, ${row.controls_checked},
      ${row.stale_controls}, ${row.open_exceptions}, ${row.findings_count}
    )
  `;
}

export async function insertSprintoMonitoringFindings(
  rows: SprintoMonitoringFindingRow[],
): Promise<void> {
  for (const row of rows) {
    await sql`
      INSERT INTO sprinto_monitoring_findings (
        id, run_id, org_id, external_id, control_key, repo,
        finding_type, severity, detail, previous_monitoring_status,
        current_monitoring_status, previous_exception_state,
        current_exception_state, previous_export_state,
        current_export_state, created_at
      ) VALUES (
        ${row.id}, ${row.run_id}, ${row.org_id}, ${row.external_id},
        ${row.control_key}, ${row.repo}, ${row.finding_type}, ${row.severity},
        ${row.detail}, ${row.previous_monitoring_status},
        ${row.current_monitoring_status}, ${row.previous_exception_state},
        ${row.current_exception_state}, ${row.previous_export_state},
        ${row.current_export_state}, ${row.created_at}
      )
    `;
  }
}
