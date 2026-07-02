-- Migration: Sprinto monitoring baselines and findings
-- Stores the last exported Sprinto-visible control state plus each monitoring run.

CREATE TABLE IF NOT EXISTS sprinto_control_baselines (
  org_id VARCHAR(16) NOT NULL,
  external_id VARCHAR(128) NOT NULL,
  control_key VARCHAR(64) NOT NULL,
  repo VARCHAR(255) NOT NULL,
  monitoring_status VARCHAR(32) NOT NULL,
  exception_state VARCHAR(32) NOT NULL,
  sprinto_export_state VARCHAR(32) NOT NULL,
  summary TEXT NOT NULL,
  synced_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (org_id, external_id)
);

CREATE TABLE IF NOT EXISTS sprinto_monitoring_runs (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  org_id VARCHAR(16) NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL,
  controls_checked INTEGER NOT NULL,
  stale_controls INTEGER NOT NULL,
  open_exceptions INTEGER NOT NULL,
  findings_count INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sprinto_monitoring_findings (
  id VARCHAR(64) NOT NULL PRIMARY KEY,
  run_id VARCHAR(64) NOT NULL REFERENCES sprinto_monitoring_runs(id) ON DELETE CASCADE,
  org_id VARCHAR(16) NOT NULL,
  external_id VARCHAR(128) NOT NULL,
  control_key VARCHAR(64) NOT NULL,
  repo VARCHAR(255) NOT NULL,
  finding_type VARCHAR(32) NOT NULL,
  severity VARCHAR(16) NOT NULL,
  detail TEXT NOT NULL,
  previous_monitoring_status VARCHAR(32),
  current_monitoring_status VARCHAR(32) NOT NULL,
  previous_exception_state VARCHAR(32),
  current_exception_state VARCHAR(32) NOT NULL,
  previous_export_state VARCHAR(32),
  current_export_state VARCHAR(32) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
