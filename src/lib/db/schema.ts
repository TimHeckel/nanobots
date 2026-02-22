/** TypeScript types matching the database schema */

export interface User {
  id: string;
  github_id: number;
  github_login: string;
  name: string | null;
  avatar_url: string | null;
  email: string | null;
  created_at: Date;
}

export interface Organization {
  id: string;
  github_installation_id: number;
  github_org_login: string;
  github_org_id: number;
  name: string;
  avatar_url: string | null;
  plan: "free" | "pro" | "enterprise";
  onboarding_completed: boolean;
  created_at: Date;
}

export interface OrgMember {
  id: string;
  org_id: string;
  user_id: string;
  role: "admin" | "member";
  joined_at: Date;
}

export interface OrgRepo {
  id: string;
  org_id: string;
  github_repo_id: number;
  full_name: string;
  default_branch: string;
  active: boolean;
}

export interface BotConfig {
  id: string;
  org_id: string;
  bot_name: string;
  enabled: boolean;
}

export interface SystemPrompt {
  id: string;
  org_id: string | null;
  agent_name: string;
  prompt_text: string;
  updated_by: string | null;
  updated_at: Date;
}

export interface PromptVersion {
  id: string;
  system_prompt_id: string;
  version_number: number;
  prompt_text: string;
  change_reason: string | null;
  changed_by: string | null;
  created_at: Date;
}

export interface PromptProposal {
  id: string;
  org_id: string;
  agent_name: string;
  current_prompt: string;
  proposed_prompt: string;
  diff_summary: string | null;
  reason: string | null;
  threat_source: string | null;
  advisory_id: string | null;
  severity: string | null;
  status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  created_at: Date;
}

export interface ScanResult {
  id: string;
  org_id: string;
  repo_full_name: string;
  trigger_type: "push" | "manual" | "scheduled" | "onboarding";
  bots_run: string[];
  findings: ScanFinding[];
  total_findings: number;
  total_prs: number;
  duration_ms: number;
  created_at: Date;
}

export interface ScanFinding {
  bot: string;
  findingCount: number;
  prUrl?: string;
}

export interface ActivityLogEntry {
  id: string;
  org_id: string;
  event_type: string;
  summary: string;
  metadata: Record<string, unknown> | null;
  actor_id: string | null;
  created_at: Date;
}

export interface ChatMessage {
  id: string;
  org_id: string;
  user_id: string;
  role: "user" | "assistant" | "tool";
  content: string | null;
  tool_calls: unknown | null;
  conversation_id: string | null;
  created_at: Date;
}

export interface Conversation {
  id: string;
  org_id: string;
  user_id: string;
  title: string;
  created_at: Date;
  updated_at: Date;
}

export interface Invitation {
  id: string;
  org_id: string;
  github_login: string;
  role: "admin" | "member";
  invited_by: string;
  status: "pending" | "accepted" | "expired";
  expires_at: Date;
}

/** The 10 built-in SaaS nanobot names (legacy — for DB seeding) */
export const BOT_NAMES = [
  // Security bots
  "console-cleanup",
  "unused-imports",
  "actions-updater",
  "secret-scanner",
  "actions-security",
  "dead-exports",
  "llm-security",
  // Documentation bots
  "readme-generator",
  "architecture-mapper",
  "api-doc-generator",
] as const;

export type BotName = (typeof BOT_NAMES)[number];

/** AI-driven bot metadata stored alongside system_prompts */
export interface BotMetadata {
  tools?: Array<{
    name: string;
    description: string;
    parameters: Record<string, { type: string; description?: string }>;
    implementation: string;
    implementationConfig?: Record<string, unknown>;
  }>;
  pipeline?: {
    fileFilter?: string;
    preProcess?: string;
    postProcess?: string;
  };
  config?: {
    fileExtensions?: string[];
    outputFormat?: "findings" | "document" | "report";
    maxFilesPerBatch?: number;
    maxSteps?: number;
    enabled?: boolean;
  };
  status?: "draft" | "testing" | "active" | "archived";
  source?: "built-in" | "user" | "autonomous";
  category?: string;
}

export interface DocGeneration {
  id: string;
  org_id: string;
  repo_full_name: string;
  doc_type: "readme" | "architecture" | "api";
  pr_url: string | null;
  generated_at: Date;
  metadata: Record<string, unknown> | null;
}

export interface ApiKey {
  id: string;
  org_id: string;
  key_hash: string;
  label: string | null;
  created_at: Date;
}

export interface WebhookEndpoint {
  id: string;
  org_id: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  status_code: number | null;
  error: string | null;
  delivered_at: Date;
}

export interface Swarm {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: Date;
}

export interface SwarmBot {
  id: string;
  swarm_id: string;
  bot_name: string;
  added_at: Date;
}
