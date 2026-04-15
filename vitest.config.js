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
        statements: 63,
        branches: 50,
        functions: 71,
        lines: 52,
      },
    },
  },
});
