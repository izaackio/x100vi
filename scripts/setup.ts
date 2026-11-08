import { randomBytes, scryptSync } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
if (existsSync('.env'))
  throw new Error('.env already exists. Edit it explicitly instead of overwriting credentials.');
const rl = createInterface({ input: process.stdin, output: process.stdout });
const email = (await rl.question('Owner email: ')).trim().toLowerCase();
rl.close();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('A valid owner email is required.');
if (!process.stdin.isTTY) throw new Error('Run setup in an interactive terminal.');
process.stdout.write('Owner password (at least 12 characters, input hidden): ');
const hidden = new Writable({
  write(_chunk, _encoding, callback) {
    callback();
  },
});
const passwordPrompt = createInterface({ input: process.stdin, output: hidden, terminal: true });
const password = await passwordPrompt.question('');
passwordPrompt.close();
process.stdout.write('\n');
if (password.length < 12 || password.length > 256)
  throw new Error('Use between 12 and 256 characters.');
const salt = randomBytes(16).toString('hex');
const hash = `scrypt$${salt}$${scryptSync(password, salt, 64).toString('hex')}`;
const dbPassword = randomBytes(24).toString('hex');
writeFileSync(
  '.env',
  `DATABASE_URL=postgresql://x100vi:${dbPassword}@127.0.0.1:5432/x100vi\nPOSTGRES_PASSWORD=${dbPassword}\nOWNER_EMAIL=${JSON.stringify(email)}\nOWNER_PASSWORD_HASH='${hash}'\nNEXTAUTH_SECRET=${randomBytes(32).toString('hex')}\nNEXTAUTH_URL=http://localhost:3000\nAPP_BASE_URL=http://localhost:3000\n`,
  { mode: 0o600, flag: 'wx' },
);
console.log('Private .env created. Next: docker compose up -d db && pnpm db:migrate && pnpm dev');
