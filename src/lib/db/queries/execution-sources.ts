import { sql } from "../index";
import type { ExecutionSourceRow } from "../execution-source";

export async function getExecutionSource(
  conversationId: string,
): Promise<ExecutionSourceRow | null> {
  const { rows } = await sql<ExecutionSourceRow>`
    SELECT conversation_id, browser_capture_phase, release_verification_phase,
           monitoring_phase, monitoring_control_id, updated_at
    FROM execution_sources
    WHERE conversation_id = ${conversationId}
  `;
  return rows[0] ?? null;
}

export async function upsertExecutionSource(
  row: ExecutionSourceRow,
): Promise<void> {
  await sql`
    INSERT INTO execution_sources (
      conversation_id, browser_capture_phase, release_verification_phase,
      monitoring_phase, monitoring_control_id, updated_at
    ) VALUES (
      ${row.conversation_id}, ${row.browser_capture_phase},
      ${row.release_verification_phase}, ${row.monitoring_phase},
      ${row.monitoring_control_id}, ${row.updated_at}
    )
    ON CONFLICT (conversation_id) DO UPDATE SET
      browser_capture_phase = EXCLUDED.browser_capture_phase,
      release_verification_phase = EXCLUDED.release_verification_phase,
      monitoring_phase = EXCLUDED.monitoring_phase,
      monitoring_control_id = EXCLUDED.monitoring_control_id,
      updated_at = EXCLUDED.updated_at
  `;
}