import { defineConfig, devices } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Playwright does not read .env.local, but the fixtures import @tourneyforge/db, which
// throws at import time without DATABASE_URL. Load the same file `next dev` uses so the
// suite talks to exactly the database the app is serving from — not a second opinion.
for (const line of readFileSync(resolve(__dirname, ".env.local"), "utf8").split("\n")) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m?.[1] && process.env[m[1]] === undefined) {
    process.env[m[1]] = m[2]!.replace(/^["']|["']$/g, "");
  }
}

/**
 * E2E config for the money path.
 *
 * Deliberately absent: any re-run-on-failure setting. A flaky assertion that passes on
 * a second attempt is a failing assertion with the evidence thrown away — and this suite
 * exists to establish facts, so a red run must stay red.
 *
 * Servers are NOT started here: `pnpm dev:up` owns that, and it verifies the ports
 * belong to this repo before using them. A webServer block here would race it.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    actionTimeout: 20_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
