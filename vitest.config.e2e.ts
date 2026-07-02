import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/e2e/control-room-*.test.ts"],
    testTimeout: 120000,
    hookTimeout: 60000,
    globals: true,
    environment: "node",
    fileParallelism: false,
    maxWorkers: 1,
  },
});
