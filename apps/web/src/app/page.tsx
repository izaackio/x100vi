import Link from 'next/link';
import { requireOwner } from '@/lib/auth';
import { getDashboard } from '@tracker/db';
import { sources, searchUrl, formatSEK, reasonLabels } from '@tracker/domain';
import { Shell, PageHeading } from '@/components/shell';
import { RunButton, RunPoller } from '@/components/controls';
export const dynamic = 'force-dynamic';
const timestamp = (date: Date | string) =>
  new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Stockholm',
  }).format(new Date(date));
export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ watch?: string; filter?: string; listing?: string }>;
}) {
  const owner = await requireOwner();
  const data = await getDashboard(owner);
  const params = await searchParams;
  const watch = data.watches.find((w) => w.id === params.watch) ?? data.watches[0];
  const all = data.listings.filter((l) => l.watch_id === watch?.id);
  const filter = params.filter ?? 'All listings';
  const filtered =
    filter === 'All listings' ? all : all.filter((l) => l.evaluation.class === filter);
  const counts = (name: string) => all.filter((l) => l.evaluation.class === name).length;
  return (
    <Shell>
      <RunPoller active={data.jobs.some((j) => ['queued', 'running'].includes(j.state))} />
      <div className="topline">
        <span>
          <span className="tiny-dot" /> YOUR PERSONAL CAMERA RADAR
        </span>
        <span>SWEDEN / SEK</span>
      </div>
      <div className="heading-row">
        <PageHeading
          eyebrow="A CAMERA WORTH WAITING FOR"
          title="The right camera. The right price."
          description="Keep your dream in focus. Every listing, every cost, one clear view."
        />
        <Link className="button" href={watch ? `/import?watch=${watch.id}` : '/watches/new'}>
          {watch ? '＋ Import listing' : 'Create your first watch →'}
        </Link>
      </div>
      <section className="budget-strip">
        <div>
          <span className="eyebrow">THE GOAL</span>
          <h2>
            Fujifilm X100VI <span>→</span>
          </h2>
          <p>Either colour. Fully working. Worth the wait.</p>
        </div>
        <div className="budget-number">
          <span className="eyebrow">YOUR TOTAL BUDGET</span>
          <strong>&lt; {formatSEK(watch?.budget ?? 1500000)}</strong>
          <p>Camera + delivery + required fees</p>
        </div>
        <div className="budget-action">
          {watch ? (
            <>
              <Link href={`/watches/${watch.id}`} className="text-button">
                Edit watch →
              </Link>
              <RunButton watchId={watch.id} />
            </>
          ) : (
            <Link href="/watches/new" className="button secondary">
              Set up a watch →
            </Link>
          )}
        </div>
      </section>
      <section className="stats-grid">
        <div>
          <span>WITHIN BUDGET</span>
          <strong>
            {counts('Within budget')}
            <small>source-confirmed deals</small>
          </strong>
        </div>
        <div>
          <span>NEEDS A CLOSER LOOK</span>
          <strong>
            {counts('Needs review')}
            <small>listings to review</small>
          </strong>
        </div>
        <div>
          <span>AUCTION WATCH</span>
          <strong>
            {counts('Auction watch')}
            <small>bids, not buy prices</small>
          </strong>
        </div>
        <div>
          <span>YOUR COLLECTION</span>
          <strong>
            {all.length}
            <small>imported listings</small>
          </strong>
        </div>
      </section>
      <div className="section-heading">
        <div>
          <p className="eyebrow">BROAD SEARCH. CAREFUL CHOICES.</p>
          <h2>Your sources</h2>
        </div>
        <span className="tag">MANUAL IMPORT MODE</span>
      </div>
      <div className="source-grid">
        {sources.map((source, i) => (
          <article className="source-card" key={source}>
            <div className="source-title">
              <span className={`source-icon source-${source}`}>{['B', 'T', 'F'][i]}</span>
              <h3 className="capitalize">{source}</h3>
              <span className="tag">
                {watch && !watch.sources.includes(source) ? 'Not selected' : 'Manual'}
              </span>
            </div>
            <p>Open the marketplace, find a listing, and bring the details here.</p>
            <a href={searchUrl(source)} target="_blank" rel="noreferrer" className="source-link">
              Open {source} search →
            </a>
          </article>
        ))}
      </div>
      <div className="notice compact">
        <strong>Live monitoring comes next.</strong> Search now re-evaluates your stored evidence.
        No marketplace is searched automatically.{' '}
        <span className={data.workerAlive ? 'worker-ok' : 'worker-off'}>
          Worker {data.workerAlive ? 'online' : 'offline — start pnpm dev'}
        </span>
      </div>
      <section className="list-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">THE SHORTLIST</p>
            <h2>Your deal feed</h2>
          </div>
          {data.watches.length > 1 && (
            <div className="watch-links">
              {data.watches.map((w) => (
                <Link
                  key={w.id}
                  href={`/?watch=${w.id}`}
                  className={`tag ${watch?.id === w.id ? 'selected' : ''}`}
                >
                  {w.name}
                </Link>
              ))}
            </div>
          )}
        </div>
        <nav className="tabs" aria-label="Listing filters">
          {[
            'All listings',
            'Within budget',
            'Needs review',
            'Auction watch',
            'Over budget',
            'Rejected',
            'Unavailable',
          ].map((label) => (
            <Link
              className={filter === label ? 'active' : ''}
              key={label}
              href={`/?watch=${watch?.id ?? ''}&filter=${encodeURIComponent(label)}`}
            >
              {label}
              <span>{label === 'All listings' ? all.length : counts(label)}</span>
            </Link>
          ))}
        </nav>
        {!filtered.length ? (
          <div className="empty-state">
            <span className="empty-icon">⌕</span>
            <h3>
              {all.length ? 'No listings in this view.' : 'Your next great find starts here.'}
            </h3>
            <p>
              {all.length
                ? 'Try another filter to see your imported listings.'
                : 'Found a promising X100VI? Import the listing and we’ll help you make sense of the price.'}
            </p>
            <Link
              href={watch ? `/import?watch=${watch.id}` : '/watches/new'}
              className="button secondary"
            >
              {watch ? 'Import your first listing →' : 'Create a watch →'}
            </Link>
          </div>
        ) : (
          <div className="listing-grid">
            {filtered.map((l) => (
              <article className="listing-card" key={l.id} id={`listing-${l.id}`}>
                <div className="listing-header">
                  <span className="eyebrow capitalize">
                    {l.source} ·{' '}
                    {l.data.offer === 'auction' ? 'CURRENT BID' : 'FIXED / ASKING PRICE'}
                  </span>
                  <span className={`pill ${l.evaluation.class === 'Rejected' ? 'danger' : ''}`}>
                    {l.evaluation.class}
                  </span>
                </div>
                <h3>{l.data.title}</h3>
                <div className="listing-price">
                  <strong>
                    {l.data.currency !== 'SEK'
                      ? 'Unsupported currency'
                      : l.evaluation.totalOre === null
                        ? formatSEK(l.evaluation.knownSubtotalOre)
                        : formatSEK(l.evaluation.totalOre)}
                  </strong>
                  <span>
                    {l.evaluation.totalOre === null
                      ? 'known subtotal · total unknown'
                      : l.data.offer === 'auction'
                        ? 'provisional bid + costs'
                        : 'user-reported total'}
                  </span>
                </div>
                <p
                  className={`budget-status ${l.evaluation.budgetStatus === 'below' ? 'below' : ''}`}
                >
                  {l.evaluation.budgetStatus === 'below'
                    ? '↘ Below your budget'
                    : l.evaluation.budgetStatus === 'at_or_above'
                      ? 'At or above your budget'
                      : 'Full cost needs checking'}
                </p>
                <div className="cost-list">
                  {l.evaluation.components.map((c) => (
                    <div key={c.label}>
                      <span>{c.label}</span>
                      <span>
                        {l.data.currency !== 'SEK'
                          ? 'Not evaluated'
                          : c.amountOre === null
                            ? 'Unknown'
                            : formatSEK(c.amountOre)}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="listing-meta">
                  {l.data.route === 'shipping'
                    ? 'Shipping'
                    : `Collection · ${l.data.location || 'location unknown'}`}{' '}
                  ·{' '}
                  {l.data.condition === 'working'
                    ? 'Seller says working'
                    : l.data.condition === 'nonworking'
                      ? 'Reported non-working'
                      : 'Condition unclear'}
                </p>
                <details open={params.listing === l.id}>
                  <summary>Validation & evidence</summary>
                  <ul className="reason-list">
                    {l.evaluation.reasons.map((reason) => (
                      <li key={reason}>{reasonLabels[reason] ?? reason}</li>
                    ))}
                  </ul>
                  <dl className="evidence">
                    <dt>Evidence origin</dt>
                    <dd>User-reported · manual import</dd>
                    <dt>Evidence supplied</dt>
                    <dd>{timestamp(l.evidence.observedAt)} Stockholm</dd>
                    <dt>Last evaluated</dt>
                    <dd>{timestamp(l.evaluation.evaluatedAt)} Stockholm</dd>
                    <dt>Rules</dt>
                    <dd>v{l.evaluation.ruleVersion}</dd>
                    <dt>Listing text</dt>
                    <dd className="excerpt">{l.evidence.excerpt}</dd>
                    {l.data.notes && (
                      <>
                        <dt>Your notes</dt>
                        <dd>{l.data.notes}</dd>
                      </>
                    )}
                  </dl>
                </details>
                <div className="listing-actions">
                  <a className="button small" href={l.url} target="_blank" rel="noreferrer">
                    Open listing →
                  </a>
                  <Link className="button secondary small" href={`/import?listing=${l.id}`}>
                    Update evidence
                  </Link>
                  <RunButton watchId={l.watch_id} listingId={l.id} />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      {!!data.jobs.length && (
        <section className="runs">
          <div className="section-heading">
            <h2>Recent checks</h2>
            <span className="muted">Stored evidence only</span>
          </div>
          {data.jobs.map((j) => (
            <div className="run" key={j.id}>
              <div>
                <strong>
                  {j.listing_id ? 'Listing recheck' : 'Watch search'} · {j.state}
                </strong>
                <small>{timestamp(j.created_at)} Stockholm</small>
              </div>
              <p>
                {j.result?.message ??
                  'Waiting for the worker. No live source fetch will be performed.'}
              </p>
              {j.result && (
                <div className="run-sources">
                  {j.result.sources.map((s) => (
                    <span key={s.source} className="tag capitalize">
                      {s.source}: manual input required
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </section>
      )}
    </Shell>
  );
}
