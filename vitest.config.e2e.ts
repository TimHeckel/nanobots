import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    include: ["tests/e2e/browser-*.test.ts"],
    testTimeout: 60000,
    hookTimeout: 60000,
    globals: true,
    environment: "node",
    fileParallelism: true,
    // Limit concurrent workers to avoid Kernel browser API rate limits.
    // Each test file creates its own browser session.
    maxWorkers: 2,
  },
});
