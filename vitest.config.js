import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts", "test/**/*.test.js"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/types/**"],
      reporter: ["text", "html"],
      thresholds: {
        statements: 52,
        branches: 31,
        functions: 62,
        lines: 52,
      },
    },
  },
});
