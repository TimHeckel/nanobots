-- Migration: execution_sources table
-- Stores durable execution state for the control room persistence seam.
-- conversation_id is the primary key (one row per conversation).

CREATE TABLE IF NOT EXISTS execution_sources (
  conversation_id VARCHAR(16) NOT NULL PRIMARY KEY
    REFERENCES conversations(id) ON DELETE CASCADE,
  browser_capture_phase VARCHAR(50) NOT NULL DEFAULT 'standby',
  release_verification_phase VARCHAR(50) NOT NULL DEFAULT 'at_risk',
  monitoring_phase VARCHAR(50) NOT NULL DEFAULT 'preview',
  monitoring_control_id VARCHAR(100),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);