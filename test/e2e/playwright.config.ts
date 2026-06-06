import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "test-results/html-report" }]],
  use: {
    baseURL: process.env.ADMIN_UI_URL ?? "http://localhost:3001",
    ignoreHTTPSErrors: true,
    headless: true,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
