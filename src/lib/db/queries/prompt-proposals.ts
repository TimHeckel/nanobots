import { sql } from "../index";
import type { PromptProposal } from "../schema";

export async function createProposal(data: {
  org_id: string;
  agent_name: string;
  current_prompt: string;
  proposed_prompt: string;
  diff_summary?: string;
  reason?: string;
  threat_source?: string;
  advisory_id?: string;
  severity?: string;
}): Promise<PromptProposal> {
  const { rows } = await sql<PromptProposal>`
    INSERT INTO prompt_proposals (org_id, agent_name, current_prompt, proposed_prompt, diff_summary, reason, threat_source, advisory_id, severity)
    VALUES (${data.org_id}, ${data.agent_name}, ${data.current_prompt}, ${data.proposed_prompt}, ${data.diff_summary ?? null}, ${data.reason ?? null}, ${data.threat_source ?? null}, ${data.advisory_id ?? null}, ${data.severity ?? null})
    RETURNING *
  `;
  return rows[0];
}

export async function getPendingProposals(orgId: string): Promise<PromptProposal[]> {
  const { rows } = await sql<PromptProposal>`
    SELECT * FROM prompt_proposals
    WHERE org_id = ${orgId} AND status = 'pending'
    ORDER BY created_at DESC
  `;
  return rows;
}

export async function getProposalById(id: string): Promise<PromptProposal | null> {
  const { rows } = await sql<PromptProposal>`SELECT * FROM prompt_proposals WHERE id = ${id}`;
  return rows[0] ?? null;
}

export async function updateProposalStatus(
  id: string,
  status: "approved" | "rejected",
  reviewedBy: string
): Promise<PromptProposal | null> {
  const { rows } = await sql<PromptProposal>`
    UPDATE prompt_proposals SET status = ${status}, reviewed_by = ${reviewedBy}
    WHERE id = ${id}
    RETURNING *
  `;
  return rows[0] ?? null;
}

export async function getPendingProposalCount(orgId: string): Promise<number> {
  const { rows } = await sql<{ count: string }>`
    SELECT COUNT(*) as count FROM prompt_proposals WHERE org_id = ${orgId} AND status = 'pending'
  `;
  return parseInt(rows[0].count, 10);
}
