import { sql } from "../index";
import type { OrgRepo } from "../schema";

export async function upsertRepos(
  orgId: string,
  repos: Array<{ github_repo_id: number; full_name: string; default_branch?: string }>
): Promise<OrgRepo[]> {
  const results: OrgRepo[] = [];
  for (const repo of repos) {
    const branch = repo.default_branch ?? "main";
    const { rows } = await sql<OrgRepo>`
      INSERT INTO org_repos (org_id, github_repo_id, full_name, default_branch)
      VALUES (${orgId}, ${repo.github_repo_id}, ${repo.full_name}, ${branch})
      ON CONFLICT DO NOTHING
      RETURNING *
    `;
    if (rows[0]) results.push(rows[0]);
  }
  return results;
}

export async function getReposForOrg(orgId: string): Promise<OrgRepo[]> {
  const { rows } = await sql<OrgRepo>`
    SELECT * FROM org_repos WHERE org_id = ${orgId} ORDER BY full_name
  `;
  return rows;
}

export async function toggleRepo(repoId: string, active: boolean): Promise<OrgRepo | null> {
  const { rows } = await sql<OrgRepo>`
    UPDATE org_repos SET active = ${active} WHERE id = ${repoId} RETURNING *
  `;
  return rows[0] ?? null;
}

export async function getRepoByFullName(orgId: string, fullName: string): Promise<OrgRepo | null> {
  const { rows } = await sql<OrgRepo>`
    SELECT * FROM org_repos WHERE org_id = ${orgId} AND full_name = ${fullName}
  `;
  return rows[0] ?? null;
}
