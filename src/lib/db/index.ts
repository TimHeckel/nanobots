const NOT_IMPLEMENTED_MESSAGE =
  "Control room database contract is not implemented yet.";

export async function sql<T = Record<string, unknown>>(
  _strings: TemplateStringsArray,
  ..._values: unknown[]
): Promise<{ rows: T[]; rowCount: number }> {
  throw new Error(NOT_IMPLEMENTED_MESSAGE);
}

export async function migrate() {
  // When wired to real Neon, this runs after all other tables:
  //
  //   CREATE TABLE IF NOT EXISTS execution_sources (
  //     conversation_id VARCHAR(16) NOT NULL PRIMARY KEY
  //       REFERENCES conversations(id) ON DELETE CASCADE,
  //     browser_capture_phase VARCHAR(50) NOT NULL DEFAULT standby,
  //     release_verification_phase VARCHAR(50) NOT NULL DEFAULT at_risk,
  //     monitoring_phase VARCHAR(50) NOT NULL DEFAULT preview,
  //     monitoring_control_id VARCHAR(100),
  //     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  //   );
  //
  // See: src/lib/db/migrations/001_execution_sources.sql
  return;
}
