export type BotStatus = "draft" | "testing" | "active" | "archived";

export interface BotDefinition {
  name: string;
  description: string;
  category: string;
  systemPrompt: string;
  tools?: ToolDefinition[];
  pipeline?: PipelineDefinition;
  outputSchema?: Record<string, unknown>;
  config: BotConfig;
  status: BotStatus;
  source?: "built-in" | "user" | "autonomous";
  createdAt?: string;
  promotedAt?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description?: string }>;
  implementation: string;
  implementationConfig?: Record<string, unknown>;
}

export interface PipelineDefinition {
  fileFilter?: string;
  preProcess?: string;
  postProcess?: string;
}

export interface BotConfig {
  fileExtensions?: string[];
  outputFormat?: "findings" | "document" | "report";
  maxFilesPerBatch?: number;
  maxSteps?: number;
  enabled?: boolean;
  [key: string]: unknown;
}

export interface BotFinding {
  file: string;
  line?: number;
  severity: "critical" | "high" | "medium" | "low" | "info";
  category: string;
  description: string;
  suggestion?: string;
  fixedContent?: string;
}

export interface TestResult {
  bot: string;
  findings: BotFinding[];
  filesScanned: number;
  durationMs: number;
  success: boolean;
  error?: string;
}

export interface ShadowResult {
  bot: string;
  findings: BotFinding[];
  filesScanned: number;
  durationMs: number;
  timestamp: number;
}
