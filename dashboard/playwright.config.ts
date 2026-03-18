import { defineConfig, devices } from "@playwright/test";

const reuseExistingServer = process.env.CI ? false : true;
const shouldManageWebServer =
  process.env.PLAYWRIGHT_DISABLE_WEBSERVER !== "1";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["html"], ["list"]] : "list",
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: "http://localhost:3001",
    headless: true,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: shouldManageWebServer
    ? [
        {
          command: "npm run build && npm run start:prod",
          cwd: "../backend",
          url: "http://localhost:3000/v1/health",
          reuseExistingServer,
          timeout: 120_000,
        },
        {
          command: "npm run build && PORT=3001 npm run start",
          cwd: ".",
          url: "http://localhost:3001",
          reuseExistingServer,
          timeout: 120_000,
        },
      ]
    : undefined,
});
