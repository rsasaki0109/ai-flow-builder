import { defineConfig, devices } from "@playwright/test";

const port = process.env.PORT ?? "3000";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`;
const databaseUrl =
  process.env.DATABASE_URL ??
  `file:${process.cwd()}/data/ai-flow-builder-e2e-${process.pid}.db`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: process.env.CI === "true" ? 2 : 0,
  workers: process.env.CI === "true" ? 1 : undefined,
  reporter:
    process.env.CI === "true"
      ? [["github"], ["html", { open: "never" }]]
      : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "mkdir -p data && pnpm db:migrate && pnpm dev",
    env: {
      AI_PROVIDER: process.env.AI_PROVIDER ?? "fake",
      APP_ROOT: process.env.APP_ROOT ?? process.cwd(),
      DATABASE_URL: databaseUrl,
      LOG_LEVEL: process.env.LOG_LEVEL ?? "silent",
      PORT: port,
    },
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === "true",
    timeout: 120_000,
    url: baseURL,
  },
});
