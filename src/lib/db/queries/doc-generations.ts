import { sql } from "../index";
import type { DocGeneration } from "../schema";

export async function storeDocGeneration(data: {
  org_id: string;
  repo_full_name: string;
  doc_type: "readme" | "architecture" | "api";
  pr_url: string | null;
  metadata?: Record<string, unknown>;
}): Promise<DocGeneration> {
  const { rows } = await sql<DocGeneration>`
    INSERT INTO doc_generations (org_id, repo_full_name, doc_type, pr_url, metadata)
    VALUES (
      ${data.org_id},
      ${data.repo_full_name},
      ${data.doc_type},
      ${data.pr_url},
      ${JSON.stringify(data.metadata ?? {})}::jsonb
    )
    RETURNING *
  `;
  return rows[0];
}

export async function getLatestDocGenerations(
  orgId: string,
  repoFullName?: string,
  limit: number = 10
): Promise<DocGeneration[]> {
  if (repoFullName) {
    const { rows } = await sql<DocGeneration>`
      SELECT * FROM doc_generations
      WHERE org_id = ${orgId} AND repo_full_name = ${repoFullName}
      ORDER BY generated_at DESC
      LIMIT ${limit}
    `;
    return rows;
  }
  const { rows } = await sql<DocGeneration>`
    SELECT * FROM doc_generations
    WHERE org_id = ${orgId}
    ORDER BY generated_at DESC
    LIMIT ${limit}
  `;
  return rows;
}

export async function getDocFreshness(
  orgId: string,
  repoFullName: string
): Promise<{ doc_type: string; generated_at: Date; pr_url: string | null }[]> {
  const { rows } = await sql<{ doc_type: string; generated_at: Date; pr_url: string | null }>`
    SELECT DISTINCT ON (doc_type) doc_type, generated_at, pr_url
    FROM doc_generations
    WHERE org_id = ${orgId} AND repo_full_name = ${repoFullName}
    ORDER BY doc_type, generated_at DESC
  `;
  return rows;
}
