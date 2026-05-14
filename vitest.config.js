import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts", "test/**/*.test.js"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/types/**", "src/index.ts", "src/misc/constants.ts"],
      reporter: ["text", "html"],
      thresholds: {
        statements: 76,
        branches: 55,
        functions: 82,
        lines: 76,
      },
    },
  },
});
