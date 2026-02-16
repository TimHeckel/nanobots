import { neon } from "@neondatabase/serverless";

function createSql() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const query = neon(connectionString, { fullResults: true });

  // Typed wrapper matching the @vercel/postgres sql<T>`...` interface
  // so all existing query files continue to work unchanged.
  return query as unknown as <T = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => Promise<{ rows: T[]; rowCount: number }>;
}

export const sql = createSql();

/**
 * Run the schema migration. Call once on deploy or dev startup.
 */
export async function migrate() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      github_id BIGINT UNIQUE NOT NULL,
      github_login VARCHAR(255) NOT NULL,
      name VARCHAR(255),
      avatar_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS organizations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      github_installation_id BIGINT UNIQUE NOT NULL,
      github_org_login VARCHAR(255) NOT NULL,
      github_org_id BIGINT NOT NULL,
      name VARCHAR(255) NOT NULL,
      avatar_url TEXT,
      plan VARCHAR(50) NOT NULL DEFAULT 'free',
      onboarding_completed BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS org_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role VARCHAR(20) NOT NULL DEFAULT 'member',
      joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(org_id, user_id)
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS org_repos (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      github_repo_id BIGINT NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      default_branch VARCHAR(255) NOT NULL DEFAULT 'main',
      active BOOLEAN NOT NULL DEFAULT true
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS bot_configs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      bot_name VARCHAR(100) NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT true,
      UNIQUE(org_id, bot_name)
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS system_prompts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
      agent_name VARCHAR(100) NOT NULL,
      prompt_text TEXT NOT NULL,
      updated_by UUID REFERENCES users(id),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(org_id, agent_name)
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS prompt_versions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      system_prompt_id UUID NOT NULL REFERENCES system_prompts(id) ON DELETE CASCADE,
      version_number INT NOT NULL,
      prompt_text TEXT NOT NULL,
      change_reason TEXT,
      changed_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS prompt_proposals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      agent_name VARCHAR(100) NOT NULL,
      current_prompt TEXT NOT NULL,
      proposed_prompt TEXT NOT NULL,
      diff_summary TEXT,
      reason TEXT,
      threat_source VARCHAR(100),
      advisory_id VARCHAR(255),
      severity VARCHAR(20),
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      reviewed_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS scan_results (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      repo_full_name VARCHAR(255) NOT NULL,
      trigger_type VARCHAR(50) NOT NULL,
      bots_run JSONB NOT NULL DEFAULT '[]',
      findings JSONB NOT NULL DEFAULT '[]',
      total_findings INT NOT NULL DEFAULT 0,
      total_prs INT NOT NULL DEFAULT 0,
      duration_ms INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS activity_log (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      event_type VARCHAR(100) NOT NULL,
      summary TEXT NOT NULL,
      metadata JSONB,
      actor_id UUID REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role VARCHAR(20) NOT NULL,
      content TEXT,
      tool_calls JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS invitations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      github_login VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'member',
      invited_by UUID NOT NULL REFERENCES users(id),
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days')
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS doc_generations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      repo_full_name VARCHAR(255) NOT NULL,
      doc_type VARCHAR(50) NOT NULL,
      pr_url TEXT,
      generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      metadata JSONB DEFAULT '{}'
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS api_keys (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      key_hash VARCHAR(64) NOT NULL,
      label VARCHAR(255),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS webhook_endpoints (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      secret VARCHAR(255) NOT NULL,
      events TEXT[] NOT NULL,
      active BOOLEAN NOT NULL DEFAULT true,
      description TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS webhook_deliveries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      webhook_id UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
      event_type VARCHAR(100) NOT NULL,
      payload JSONB NOT NULL,
      status_code INT,
      error TEXT,
      delivered_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS swarms (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      created_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(org_id, name)
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS swarm_bots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      swarm_id UUID NOT NULL REFERENCES swarms(id) ON DELETE CASCADE,
      bot_name VARCHAR(100) NOT NULL,
      added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(swarm_id, bot_name)
    )`;
}
