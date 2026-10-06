import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against a running app with the demo seed (`pnpm db:migrate && pnpm db:seed`).
 * Uses the locally installed Chrome, so no browser download is needed.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  // The dev server compiles pages on first visit: allow for that instead of flaking.
  expect: { timeout: 15_000 },
  timeout: 90_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3400",
    channel: "chrome",
    // The citizen flow follows the device language: tests assert the Italian copy.
    locale: "it-IT",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], channel: "chrome", locale: "it-IT" },
      testMatch: /citizen|landing/,
    },
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], channel: "chrome", locale: "it-IT" },
      testMatch: /console|landing|screenshots/,
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3400/api/health",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
