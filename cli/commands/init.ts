import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { generateDefaultConfig } from "../config";

const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const DIM = "\x1b[2m";

export async function initCommand(targetDir?: string): Promise<number> {
  const dir = targetDir ?? ".";
  const filePath = join(dir, ".nanobots.toml");

  try {
    await writeFile(filePath, generateDefaultConfig(), { flag: "wx" });
    process.stdout.write(
      `\n  ${GREEN}Created${RESET} ${filePath}\n` +
        `  ${DIM}Set your API key: OPENROUTER_API_KEY=... or edit the file${RESET}\n` +
        `  ${DIM}Get a free key at https://openrouter.ai/keys${RESET}\n\n`,
    );
    return 0;
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "EEXIST"
    ) {
      process.stderr.write(`\n  .nanobots.toml already exists in ${dir}\n\n`);
      return 1;
    }
    process.stderr.write(`\n  Failed to create config: ${error}\n\n`);
    return 1;
  }
}
