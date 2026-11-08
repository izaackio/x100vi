import { config } from 'dotenv';
import { Pool, type PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import {
  evaluate,
  canonicalListingUrl,
  type ListingData,
  type Evidence,
  type Evaluation,
  type Source,
} from '../../domain/src/index';
config({ path: '.env', quiet: true });
const globalDb = globalThis as unknown as { trackerPool?: Pool };
export const pool =
  globalDb.trackerPool ??
  new Pool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 5000 });
if (process.env.NODE_ENV !== 'production') globalDb.trackerPool = pool;
export type Watch = {
  id: string;
  owner_email: string;
  name: string;
  budget: number;
  sources: Source[];
  collection_locations: string;
  revision: number;
};
export type Listing = {
  id: string;
  watch_id: string;
  source: Source;
  external_id: string;
  url: string;
  data: ListingData;
  evidence: Evidence;
  evaluation: Evaluation;
  revision: number;
  first_seen_at: Date;
  updated_at: Date;
};
export type Job = {
  id: string;
  state: string;
  listing_id: string | null;
  created_at: Date;
  result: null | {
    sources: { source: Source; state: string; message: string }[];
    evaluated: number;
    message: string;
  };
};
export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
export async function getDashboard(owner: string) {
  const watches = (
    await pool.query<Watch>('SELECT * FROM watches WHERE owner_email=$1 ORDER BY created_at', [
      owner,
    ])
  ).rows;
  const listings = (
    await pool.query<Listing>(
      'SELECT l.* FROM listings l JOIN watches w ON w.id=l.watch_id WHERE w.owner_email=$1 ORDER BY l.updated_at DESC',
      [owner],
    )
  ).rows;
  const jobs = (
    await pool.query<Job>(
      'SELECT j.* FROM jobs j JOIN watches w ON w.id=j.watch_id WHERE w.owner_email=$1 ORDER BY j.created_at DESC LIMIT 10',
      [owner],
    )
  ).rows;
  const health = (
    await pool.query<{ alive: boolean }>(
      "SELECT heartbeat_at > now()-interval '30 seconds' AS alive FROM worker_health WHERE id=1",
    )
  ).rows[0];
  return { watches, listings, jobs, workerAlive: health?.alive ?? false };
}
export async function saveWatch(
  owner: string,
  input: {
    id?: string;
    expectedRevision?: number;
    name: string;
    budget: number;
    sources: Source[];
    collectionLocations: string;
  },
) {
  return transaction(async (c) => {
    let watch: Watch;
    if (input.id) {
      const result = await c.query<Watch>(
        'UPDATE watches SET name=$1,budget=$2,sources=$3,collection_locations=$4,revision=revision+1 WHERE id=$5 AND owner_email=$6 AND revision=$7 RETURNING *',
        [
          input.name,
          input.budget,
          JSON.stringify(input.sources),
          input.collectionLocations,
          input.id,
          owner,
          input.expectedRevision,
        ],
      );
      if (!result.rowCount)
        throw new Error('Watch changed in another window. Reload and try again.');
      watch = result.rows[0];
    } else {
      watch = (
        await c.query<Watch>(
          'INSERT INTO watches(id,owner_email,name,budget,sources,collection_locations) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',
          [
            randomUUID(),
            owner,
            input.name,
            input.budget,
            JSON.stringify(input.sources),
            input.collectionLocations,
          ],
        )
      ).rows[0];
    }
    const listings = (
      await c.query<Listing>('SELECT * FROM listings WHERE watch_id=$1 FOR UPDATE', [watch.id])
    ).rows;
    for (const l of listings) {
      const evaluation = evaluate(
        l.data,
        { budget: watch.budget, collectionLocations: watch.collection_locations },
        l.evidence,
      );
      await c.query('UPDATE listings SET evaluation=$1 WHERE id=$2', [
        JSON.stringify(evaluation),
        l.id,
      ]);
    }
    return watch;
  });
}
export async function importListing(owner: string, data: ListingData, expectedRevision?: number) {
  const ref = canonicalListingUrl(data.url);
  return transaction(async (c) => {
    // Lock the watch to serialize imports and settings edits.
    const watch = (
      await c.query<Watch>('SELECT * FROM watches WHERE id=$1 AND owner_email=$2 FOR UPDATE', [
        data.watchId,
        owner,
      ])
    ).rows[0];
    if (!watch) throw new Error('Watch not found.');
    if (!watch.sources.includes(ref.source))
      throw new Error('Enable this source in your watch before importing.');
    const existing = (
      await c.query<Listing>(
        'SELECT * FROM listings WHERE watch_id=$1 AND source=$2 AND external_id=$3 FOR UPDATE',
        [watch.id, ref.source, ref.externalId],
      )
    ).rows[0];
    if (existing && expectedRevision !== undefined && existing.revision !== expectedRevision)
      throw new Error('Listing changed in another window. Reload before updating.');
    const id = existing?.id ?? randomUUID();
    const evidence: Evidence = {
      origin: 'user_reported',
      observedAt: new Date().toISOString(),
      sourceUrl: ref.url,
      method: 'manual_import',
      excerpt: `${data.title}\n${data.description}`,
    };
    const evaluation = evaluate(
      data,
      { budget: watch.budget, collectionLocations: watch.collection_locations },
      evidence,
    );
    await c.query(
      `INSERT INTO listings(id,watch_id,source,external_id,url,data,evidence,evaluation) VALUES($1,$2,$3,$4,$5,$6,$7,$8)
   ON CONFLICT(watch_id,source,external_id) DO UPDATE SET data=EXCLUDED.data,evidence=EXCLUDED.evidence,evaluation=EXCLUDED.evaluation,revision=listings.revision+1,updated_at=now()`,
      [
        id,
        watch.id,
        ref.source,
        ref.externalId,
        ref.url,
        JSON.stringify({ ...data, url: ref.url }),
        JSON.stringify(evidence),
        JSON.stringify(evaluation),
      ],
    );
    await c.query(
      'INSERT INTO observations(listing_id,data,evidence,evaluation) VALUES($1,$2,$3,$4)',
      [id, JSON.stringify(data), JSON.stringify(evidence), JSON.stringify(evaluation)],
    );
    return id;
  });
}
export async function enqueue(owner: string, watchId: string, listingId?: string) {
  return transaction(async (c) => {
    const watch = (
      await c.query<Watch>('SELECT * FROM watches WHERE id=$1 AND owner_email=$2 FOR UPDATE', [
        watchId,
        owner,
      ])
    ).rows[0];
    if (!watch) throw new Error('Watch not found.');
    if (
      listingId &&
      !(await c.query('SELECT 1 FROM listings WHERE id=$1 AND watch_id=$2', [listingId, watchId]))
        .rowCount
    )
      throw new Error('Listing not found.');
    const active = (
      await c.query<{ id: string }>(
        "SELECT id FROM jobs WHERE watch_id=$1 AND listing_id IS NOT DISTINCT FROM $2::uuid AND state IN ('queued','running')",
        [watchId, listingId ?? null],
      )
    ).rows[0];
    if (active) return active.id;
    const id = randomUUID();
    await c.query('INSERT INTO jobs(id,watch_id,listing_id) VALUES($1,$2,$3)', [
      id,
      watchId,
      listingId ?? null,
    ]);
    return id;
  });
}
export async function workOnce() {
  return transaction(async (c) => {
    await c.query(
      'INSERT INTO worker_health(id,heartbeat_at) VALUES(1,now()) ON CONFLICT(id) DO UPDATE SET heartbeat_at=now()',
    );
    const job = (
      await c.query<{ id: string; watch_id: string; listing_id: string | null }>(
        "SELECT id,watch_id,listing_id FROM jobs WHERE state='queued' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1",
      )
    ).rows[0];
    if (!job) return false;
    await c.query(
      "UPDATE jobs SET state='running',started_at=now(),attempts=attempts+1 WHERE id=$1",
      [job.id],
    );
    const watch = (
      await c.query<Watch>('SELECT * FROM watches WHERE id=$1 FOR UPDATE', [job.watch_id])
    ).rows[0];
    const listings = (
      await c.query<Listing>(
        'SELECT * FROM listings WHERE watch_id=$1 AND ($2::uuid IS NULL OR id=$2) FOR UPDATE',
        [watch.id, job.listing_id],
      )
    ).rows;
    for (const listing of listings) {
      const evaluation = evaluate(
        listing.data,
        { budget: watch.budget, collectionLocations: watch.collection_locations },
        listing.evidence,
      );
      // A recheck cannot fabricate a fresh source observation.
      await c.query('UPDATE listings SET evaluation=$1 WHERE id=$2', [
        JSON.stringify(evaluation),
        listing.id,
      ]);
    }
    const result = {
      evaluated: listings.length,
      message:
        'Stored evidence re-evaluated. Open each source to check live listings; no marketplace was searched automatically.',
      sources: watch.sources.map((source) => ({
        source,
        state: 'manual_required',
        message: 'Automatic collection is not enabled. Open source search, then import a listing.',
      })),
    };
    await c.query("UPDATE jobs SET state='completed',finished_at=now(),result=$1 WHERE id=$2", [
      JSON.stringify(result),
      job.id,
    ]);
    return true;
  });
}
