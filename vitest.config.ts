import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    globals: true,
    include: ["tests/**/*.test.ts"],
    exclude: ["node_modules", "dist", ".next", "tests/e2e/browser-*.test.ts", "tests/e2e/cli-agents.test.ts", "tests/integration/**"],
    coverage: {
      provider: "v8",
      include: [
        "src/lib/nanobots/ai-bots/**",
        "cli/bots/**",
        "cli/analyzer.ts",
        "cli/commands/**",
      ],
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
