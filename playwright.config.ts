import { defineConfig } from '@playwright/test';
import { config } from 'dotenv';
const testEnv = config({ path: '.env.test', override: true, quiet: true });
if (
  !testEnv.parsed?.DATABASE_URL ||
  new URL(testEnv.parsed.DATABASE_URL).pathname !== '/x100vi_test'
) {
  throw new Error('Run pnpm test:setup first. Tests require the isolated x100vi_test database.');
}
config({ path: '.env', quiet: true });
export default defineConfig({
  testDir: 'tests/e2e',
  workers: 1,
  fullyParallel: false,
  timeout: 60000,
  use: {
    baseURL: process.env.APP_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {},
  },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000/login',
    reuseExistingServer: false,
    timeout: 120000,
  },
});
