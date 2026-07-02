import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/proof/**/*.test.ts", "tests/proof/**/*.test.tsx"],
    exclude: ["node_modules", "dist", ".next", "tests/e2e/**", "tests/integration/**"],
    coverage: {
      provider: "v8",
      all: true,
      clean: true,
      reportsDirectory: "./coverage",
      reporter: ["text", "json-summary", "html"],
      include: [
        "src/app/**/*.{ts,tsx}",
        "src/components/**/*.{ts,tsx}",
        "src/lib/compliance/sprinto.ts",
        "src/lib/compliance/monitoring.ts",
        "src/lib/db/index.ts",
        "src/lib/db/execution-source.ts",
        "src/lib/db/monitoring.ts",
        "src/lib/db/control-gap-state.ts",
        "src/lib/db/evidence-sync-state.ts",
        "src/lib/chat/control-room-execution-source-seed.ts",
        "src/lib/chat/conversation-thread-store.ts",
        "src/lib/chat/control-room-state.ts",
        "src/lib/chat/control-room-execution-source.ts",
        "src/lib/chat/exception-export-execution-source.ts",
        "src/lib/chat/control-gap-state.ts",
        "src/lib/chat/evidence-sync-state.ts",
        "src/lib/chat/tools/connect-evidence-source.ts",
        "src/lib/chat/tools/inspect-control-gaps.ts",
        "src/lib/chat/tools/resolve-control-gap.ts",
        "src/lib/chat/tools/sync-evidence-source.ts",
      ],
      exclude: ["**/*.d.ts", "src/app/favicon.ico"],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
        },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
