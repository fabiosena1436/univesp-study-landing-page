import { defineConfig } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.resolve("artifacts/pw-browsers");
const config = JSON.parse(readFileSync(".test-env.json", "utf8")) as { baseUrl: string; databaseUrl: string };
const database = new URL(config.databaseUrl);
if (!database.pathname.startsWith("/aprova_test")) throw new Error("Browser tests require an isolated test database.");
export default defineConfig({
  testDir: "./tests/browser", workers: 1, fullyParallel: false, timeout: 45000,
  outputDir: "artifacts/browser-results", reporter: [["line"], ["html", { outputFolder: "artifacts/browser-report", open: "never" }]],
  use: { baseURL: config.baseUrl, trace: "retain-on-failure", screenshot: "only-on-failure", viewport: { width: 1280, height: 900 } },
  webServer: {
    command: "node --import ./scripts/test-email-mock.mjs node_modules/next/dist/bin/next start -p 3100",
    env: {
      DATABASE_URL: config.databaseUrl, APP_URL: config.baseUrl, TZ: "UTC", GEMINI_API_KEY: "", GROQ_API_KEY: "",
      MFA_ENCRYPTION_KEY: "11".repeat(32), MFA_REQUIRE_ADMIN: "false",
      RESEND_API_KEY: "test-only-fake-key", RESEND_FROM_EMAIL: "Test <test@example.invalid>",
    },
    url: `${config.baseUrl}/api/health`, timeout: 60000, reuseExistingServer: false,
  },
});
