import { config } from 'dotenv';
import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes, scryptSync } from 'node:crypto';
import { Client } from 'pg';
config({ path: '.env', quiet: true });
if (existsSync('.env.test'))
  throw new Error(
    '.env.test exists. Remove it explicitly if you need fresh local test credentials.',
  );
if (!process.env.DATABASE_URL) throw new Error('Run pnpm owner:setup first.');
const url = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
  throw new Error('Test setup only supports a local database.');
const client = new Client({ connectionString: url.toString() });
await client.connect();
try {
  if (!(await client.query("SELECT 1 FROM pg_database WHERE datname='x100vi_test'")).rowCount)
    await client.query('CREATE DATABASE x100vi_test');
} finally {
  await client.end();
}
url.pathname = '/x100vi_test';
const password = randomBytes(24).toString('hex');
const salt = randomBytes(16).toString('hex');
writeFileSync(
  '.env.test',
  `DATABASE_URL=${url}\nOWNER_EMAIL=owner@example.test\nOWNER_PASSWORD_HASH='scrypt$${salt}$${scryptSync(password, salt, 64).toString('hex')}'\nNEXTAUTH_SECRET=${randomBytes(32).toString('hex')}\nNEXTAUTH_URL=http://localhost:3000\nAPP_BASE_URL=http://localhost:3000\nTEST_OWNER_PASSWORD=${password}\n`,
  { mode: 0o600, flag: 'wx' },
);
console.log(
  'Isolated local test database and private .env.test are ready. Run pnpm db:migrate:test.',
);
