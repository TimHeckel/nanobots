import { sql } from "../index";
import type { SystemPrompt, PromptVersion } from "../schema";

export async function getSystemPrompt(orgId: string, agentName: string): Promise<SystemPrompt | null> {
  // Try org-specific first, fall back to global default
  const { rows } = await sql<SystemPrompt>`
    SELECT * FROM system_prompts
    WHERE (org_id = ${orgId} OR org_id IS NULL)
    AND agent_name = ${agentName}
    ORDER BY org_id IS NULL ASC
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function getGlobalDefault(agentName: string): Promise<SystemPrompt | null> {
  const { rows } = await sql<SystemPrompt>`
    SELECT * FROM system_prompts WHERE org_id IS NULL AND agent_name = ${agentName}
  `;
  return rows[0] ?? null;
}

export async function upsertSystemPrompt(
  orgId: string | null,
  agentName: string,
  promptText: string,
  updatedBy: string | null
): Promise<SystemPrompt> {
  if (orgId) {
    const { rows } = await sql<SystemPrompt>`
      INSERT INTO system_prompts (org_id, agent_name, prompt_text, updated_by, updated_at)
      VALUES (${orgId}, ${agentName}, ${promptText}, ${updatedBy}, now())
      ON CONFLICT (org_id, agent_name)
      DO UPDATE SET prompt_text = ${promptText}, updated_by = ${updatedBy}, updated_at = now()
      RETURNING *
    `;
    return rows[0];
  }
  const { rows } = await sql<SystemPrompt>`
    INSERT INTO system_prompts (org_id, agent_name, prompt_text, updated_by, updated_at)
    VALUES (NULL, ${agentName}, ${promptText}, ${updatedBy}, now())
    ON CONFLICT (org_id, agent_name)
    DO UPDATE SET prompt_text = ${promptText}, updated_by = ${updatedBy}, updated_at = now()
    RETURNING *
  `;
  return rows[0];
}

export async function createVersion(
  systemPromptId: string,
  versionNumber: number,
  promptText: string,
  changeReason: string | null,
  changedBy: string | null
): Promise<PromptVersion> {
  const { rows } = await sql<PromptVersion>`
    INSERT INTO prompt_versions (system_prompt_id, version_number, prompt_text, change_reason, changed_by)
    VALUES (${systemPromptId}, ${versionNumber}, ${promptText}, ${changeReason}, ${changedBy})
    RETURNING *
  `;
  return rows[0];
}

export async function getVersionCount(systemPromptId: string): Promise<number> {
  const { rows } = await sql<{ count: string }>`
    SELECT COUNT(*) as count FROM prompt_versions WHERE system_prompt_id = ${systemPromptId}
  `;
  return parseInt(rows[0].count, 10);
}

export async function getAllSystemPrompts(orgId: string): Promise<SystemPrompt[]> {
  const { rows } = await sql<SystemPrompt>`
    SELECT * FROM system_prompts
    WHERE org_id = ${orgId} OR org_id IS NULL
    ORDER BY agent_name
  `;
  return rows;
}

/** Seed global default prompts (used during DB init) */
export async function seedDefaultPrompts(): Promise<void> {
  const defaults: Record<string, string> = {
    "console-cleanup": "You are a code hygiene bot that identifies and removes console.log, console.debug, and console.info statements from production code. Preserve console.warn and console.error. Skip test files and configuration files.",
    "unused-imports": "You are a code hygiene bot that identifies and removes import statements that are completely unused in the file. Handle default imports, named imports, namespace imports, and aliases. Never remove side-effect imports.",
    "actions-updater": "You are a CI/CD maintenance bot that updates deprecated GitHub Actions to their latest major versions. Map old versions to current ones and detect deprecated commands.",
    "secret-scanner": "You are a security bot that detects hardcoded secrets, API keys, tokens, and credentials in source code. Check for AWS keys, GitHub tokens, Slack webhooks, private keys, database URLs, and other sensitive patterns. Mask any secrets in your output.",
    "actions-security": "You are a security bot that pins GitHub Actions to immutable SHA digests to prevent tag hijacking attacks. Reference specific pinned versions for common actions.",
    "dead-exports": "You are a code hygiene bot that identifies exported symbols that are never imported by any other file in the project. Remove the export keyword but keep the declaration. Skip index files, pages, layouts, and routes.",
    "llm-security": "You are a security bot that detects OWASP LLM Top 10 vulnerabilities. Check for prompt injection (user input in template literals passed to LLMs) and unsafe output handling (LLM output in eval, innerHTML, SQL queries, or shell commands).",
    "chat": "You are the nanobots.sh AI assistant. You help users manage their nanobot configuration, review scan results, handle security proposals, and invite team members. Be concise, helpful, and proactive about surfacing important security information.",
  };

  for (const [agent, prompt] of Object.entries(defaults)) {
    await sql`
      INSERT INTO system_prompts (org_id, agent_name, prompt_text, updated_at)
      VALUES (NULL, ${agent}, ${prompt}, now())
      ON CONFLICT (org_id, agent_name) DO NOTHING
    `;
  }
}
