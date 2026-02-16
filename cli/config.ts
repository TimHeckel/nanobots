import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface NanobotsConfig {
  provider: string;
  model: string;
  apiKey: string;
  disabledBots: string[];
  ignorePaths: string[];
}

const DEFAULT_CONFIG: NanobotsConfig = {
  provider: "openrouter",
  model: "meta-llama/llama-4-maverick",
  apiKey: "",
  disabledBots: [],
  ignorePaths: ["node_modules/", "dist/", ".next/", "*.min.js", "*.min.css"],
};

/**
 * Minimal TOML parser — handles only the flat key=value and array formats
 * we use in .nanobots.toml. No nested tables needed.
 */
function parseToml(content: string): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) continue;

    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) continue;

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();

    // Inline comment removal (only outside quotes)
    if (value.startsWith('"')) {
      const closing = value.indexOf('"', 1);
      if (closing !== -1) {
        value = value.slice(1, closing);
      }
    } else if (value.startsWith("[")) {
      // Parse array: ["a", "b", "c"]
      const items: string[] = [];
      const inner = value.slice(1, value.lastIndexOf("]"));
      for (const part of inner.split(",")) {
        const trimmed = part.trim().replace(/^["']|["']$/g, "");
        if (trimmed) items.push(trimmed);
      }
      result[key] = items;
      continue;
    } else {
      // Remove inline comment
      const commentIndex = value.indexOf("#");
      if (commentIndex !== -1) {
        value = value.slice(0, commentIndex).trim();
      }
      // Remove surrounding quotes if present
      value = value.replace(/^["']|["']$/g, "");
    }

    result[key] = value;
  }

  return result;
}

export async function loadConfig(dir: string): Promise<NanobotsConfig> {
  const config = { ...DEFAULT_CONFIG };

  try {
    const content = await readFile(join(dir, ".nanobots.toml"), "utf-8");
    const parsed = parseToml(content);

    if (typeof parsed.provider === "string") config.provider = parsed.provider;
    if (typeof parsed.model === "string") config.model = parsed.model;
    if (typeof parsed.api_key === "string") config.apiKey = parsed.api_key;
    if (Array.isArray(parsed.disabled_bots))
      config.disabledBots = parsed.disabled_bots;
    if (Array.isArray(parsed.ignore_paths))
      config.ignorePaths = parsed.ignore_paths;
  } catch {
    // No config file — use defaults
  }

  // Env var overrides
  if (process.env.OPENROUTER_API_KEY) {
    config.apiKey = process.env.OPENROUTER_API_KEY;
  }

  return config;
}

export function generateDefaultConfig(): string {
  return `# Nanobots CLI Configuration
# https://nanobots.sh

# Provider configuration
provider = "openrouter"              # openrouter | ollama (future)
model = "meta-llama/llama-4-maverick"  # any OpenRouter model
api_key = ""                          # or set OPENROUTER_API_KEY env var

# Bot configuration
disabled_bots = []
ignore_paths = ["node_modules/", "dist/", ".next/", "*.min.js", "*.min.css"]
`;
}
