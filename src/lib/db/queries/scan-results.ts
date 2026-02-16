import { sql } from "../index";
import type { ScanResult, ScanFinding } from "../schema";

export async function storeScanResult(data: {
  org_id: string;
  repo_full_name: string;
  trigger_type: "push" | "manual" | "scheduled" | "onboarding";
  bots_run: string[];
  findings: ScanFinding[];
  total_findings: number;
  total_prs: number;
  duration_ms: number;
}): Promise<ScanResult> {
  const { rows } = await sql<ScanResult>`
    INSERT INTO scan_results (org_id, repo_full_name, trigger_type, bots_run, findings, total_findings, total_prs, duration_ms)
    VALUES (
      ${data.org_id},
      ${data.repo_full_name},
      ${data.trigger_type},
      ${JSON.stringify(data.bots_run)}::jsonb,
      ${JSON.stringify(data.findings)}::jsonb,
      ${data.total_findings},
      ${data.total_prs},
      ${data.duration_ms}
    )
    RETURNING *
  `;
  return rows[0];
}

export async function getRecentScans(
  orgId: string,
  repoFullName?: string,
  limit: number = 10
): Promise<ScanResult[]> {
  if (repoFullName) {
    const { rows } = await sql<ScanResult>`
      SELECT * FROM scan_results
      WHERE org_id = ${orgId} AND repo_full_name = ${repoFullName}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return rows;
  }
  const { rows } = await sql<ScanResult>`
    SELECT * FROM scan_results
    WHERE org_id = ${orgId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return rows;
}

export async function getStats(orgId: string): Promise<{
  totalScans: number;
  totalFindings: number;
  totalPrs: number;
  findingsByBot: Record<string, number>;
}> {
  const { rows: countRows } = await sql<{
    total_scans: string;
    total_findings: string;
    total_prs: string;
  }>`
    SELECT
      COUNT(*) as total_scans,
      COALESCE(SUM(total_findings), 0) as total_findings,
      COALESCE(SUM(total_prs), 0) as total_prs
    FROM scan_results
    WHERE org_id = ${orgId}
  `;

  const { rows: botRows } = await sql<{ bot: string; count: string }>`
    SELECT f->>'bot' as bot, SUM((f->>'findingCount')::int) as count
    FROM scan_results, jsonb_array_elements(findings) as f
    WHERE org_id = ${orgId}
    GROUP BY f->>'bot'
    ORDER BY count DESC
  `;

  const findingsByBot: Record<string, number> = {};
  for (const row of botRows) {
    findingsByBot[row.bot] = parseInt(row.count, 10);
  }

  return {
    totalScans: parseInt(countRows[0].total_scans, 10),
    totalFindings: parseInt(countRows[0].total_findings, 10),
    totalPrs: parseInt(countRows[0].total_prs, 10),
    findingsByBot,
  };
}
