import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';
const testEnv = config({ path: '.env.test', override: true, quiet: true });
if (
  !testEnv.parsed?.DATABASE_URL ||
  new URL(testEnv.parsed.DATABASE_URL).pathname !== '/x100vi_test'
) {
  throw new Error('Run pnpm test:setup first. Tests require the isolated x100vi_test database.');
}
export default defineConfig({
  test: { include: ['tests/integration.test.ts'], fileParallelism: false },
});
