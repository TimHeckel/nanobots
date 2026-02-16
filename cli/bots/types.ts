// Re-export shared types from ai-bots
export type {
  BotDefinition,
  BotStatus,
  ToolDefinition,
  PipelineDefinition,
  BotConfig,
  BotFinding,
  TestResult,
  ShadowResult,
} from "../../src/lib/nanobots/ai-bots/types";

// Legacy AIBot interface for backward compatibility
export interface RepoFile {
  path: string;
  content: string;
}

export interface AIBot {
  name: string;
  description: string;
  category: "security" | "quality" | "docs";
  fileExtensions: string[];
  maxFilesPerBatch: number;
  systemPrompt: string;
  userPromptTemplate: (files: RepoFile[]) => string;
  parseResponse: (response: string) => BotFinding[];
}

// Re-import for the legacy interface
import type { BotFinding } from "../../src/lib/nanobots/ai-bots/types";
