import { pool, workOnce } from '../../../packages/db/src/index';
let stopped = false;
process.on('SIGINT', () => {
  stopped = true;
});
process.on('SIGTERM', () => {
  stopped = true;
});
console.log('Tracker worker running. Live source collection is not enabled.');
async function main() {
  while (!stopped) {
    try {
      await workOnce();
    } catch {
      console.error(
        'Worker could not complete a database job. Check database availability; the transaction remains queued for retry.',
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  await pool.end();
}
void main();
