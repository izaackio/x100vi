import { readFile } from 'node:fs/promises';
import { pool, transaction } from '../packages/db/src/index';
try {
  await transaction(async (c) => {
    await c.query('SELECT pg_advisory_xact_lock(10061001)');
    await c.query(
      await readFile(new URL('../packages/db/src/schema.sql', import.meta.url), 'utf8'),
    );
  });
  console.log('Database schema is ready.');
} finally {
  await pool.end();
}
