import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.WEBSITE_BASE_URL || "http://127.0.0.1:4173";

export default defineConfig({
  testDir: ".",
  testMatch: "e2e.spec.js",
  outputDir: "artifacts/test-results",
  reporter: "line",
  use: {
    baseURL,
    trace: "retain-on-failure"
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } },
    { name: "mobile-chromium", use: { ...devices["iPhone 13"], browserName: "chromium" } }
  ],
  webServer: process.env.WEBSITE_BASE_URL ? undefined : {
    command: "node dev.js",
    cwd: import.meta.dirname,
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true
  }
});
