CREATE TABLE IF NOT EXISTS watches (
 id uuid PRIMARY KEY, owner_email text NOT NULL, name text NOT NULL,
 budget integer NOT NULL CHECK (budget > 0), sources jsonb NOT NULL,
 collection_locations text NOT NULL DEFAULT '', revision integer NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS listings (
 id uuid PRIMARY KEY, watch_id uuid NOT NULL REFERENCES watches(id) ON DELETE CASCADE,
 source text NOT NULL CHECK (source IN ('blocket','tradera','fotosidan')), external_id text NOT NULL,
 url text NOT NULL, data jsonb NOT NULL, evidence jsonb NOT NULL, evaluation jsonb NOT NULL,
 revision integer NOT NULL DEFAULT 1, first_seen_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (watch_id, source, external_id)
);
CREATE TABLE IF NOT EXISTS observations (
 id bigserial PRIMARY KEY, listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
 data jsonb NOT NULL, evidence jsonb NOT NULL, evaluation jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS jobs (
 id uuid PRIMARY KEY, watch_id uuid NOT NULL REFERENCES watches(id) ON DELETE CASCADE,
 listing_id uuid REFERENCES listings(id) ON DELETE CASCADE,
 state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','running','completed','failed')),
 result jsonb, attempts integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(),
 started_at timestamptz, finished_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS active_watch_run ON jobs (watch_id) WHERE state IN ('queued','running') AND listing_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS active_listing_run ON jobs (listing_id) WHERE state IN ('queued','running') AND listing_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS login_attempts (key text PRIMARY KEY, count integer NOT NULL, expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS worker_health (id integer PRIMARY KEY CHECK(id=1), heartbeat_at timestamptz NOT NULL);
CREATE INDEX IF NOT EXISTS listings_watch_idx ON listings(watch_id);
CREATE INDEX IF NOT EXISTS jobs_watch_idx ON jobs(watch_id, created_at DESC);
