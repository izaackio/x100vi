# X100VI tracker: implementation specification

Status: proposed implementation; documentation only. Date: 8 November 2026.
Repository: https://github.com/izaackio/x100vi

## 1. Objective and scope

Help one owner find and manually buy a working Fujifilm X100VI for **less than 15,000 SEK including the costs of the selected purchase route**. Cover the first three tracker capabilities: (1) collection across different source types, (2) broad search followed by careful qualification, and (3) full-cost budget validation. User-triggered searches, scheduled monitoring, results and alerts complete those capabilities.

Sources in this release are Blocket, Tradera and Fotosidan only. Support Swedish domestic listings in SEK, either colour, private and business sellers, cosmetic wear, and working cameras. Include a bundle only at its entire asking price; never deduct hypothetical accessory resale value. Used is acceptable by default; no arbitrary shutter-count cutoff. Flag disclosed faults for review and reject explicitly non-working cameras from budget alerts.

No automatic purchases, bids, offers or seller messages. No guarantee of seller legitimacy, physical condition, availability at checkout or complete marketplace coverage. No international/foreign-currency deal qualification in this release. No AI dependency, global scraping engine or mailbox-wide access.

## 2. Default search profile

| Setting | Default / semantics |
| --- | --- |
| Product | Fujifilm X100VI; exact generation required for eligibility |
| Total budget | 1,500,000 öre, exclusive; `totalOre < budgetOre` |
| Sources | Blocket, Tradera, Fotosidan |
| Geography | Sweden; domestic shipping supported |
| Collection | Disabled until owner supplies acceptable municipalities and a travel allowance per route |
| Condition | New, used, refurbished; working; cosmetic wear allowed |
| Colour | Silver or black |
| Discovery price limit | None in v1; filter after parsing so ambiguous prices and price changes are retained |
| Tight search variants | `X100VI`, `X100 VI`, `Fuji X100VI`, `Fujifilm X100VI` |
| Broad search variants | `Fujifilm X100`, `Fuji X100`; lower priority and require stronger model evidence |
| Automatic cadence | Target 15 minutes per source, only after access qualification; source limits can require slower operation |
| Alerts | Dashboard always; owner enables email; Telegram optional |
| Monitoring | Off on creation; explicit Enable monitoring starts scheduling |
| Display timezone | Europe/Stockholm by default; store timestamps in UTC and allow owner override |

Run separate queries if a marketplace does not support OR syntax. Do not assume punctuation, spaces or category filters behave identically across sources. Deduplicate discovered IDs before detail fetches. Use photo/camera category filters only after verifying they do not exclude valid listings; include a category-free tight search to catch miscategorised cameras. Broad searches run on manual runs and hourly during monitoring; tight searches run every qualified source interval.

Parse Unicode spaces and Swedish formats such as `14 500 kr`, `14 500:-`, and `14.500,00 SEK` with explicit locale rules. Reject ambiguous mixed-currency strings, malformed grouping and numeric text that cannot be assigned a price role. Preserve the original string. Never select the lowest number on a page: monthly payments, shutter counts and accessory prices are not camera prices.

## 3. Source integration and qualification

Each adapter exposes its actual capabilities: `automatic_search`, `detail_fetch`, `native_alert_help`, `manual_import`, `supported_filters`, `min_interval_seconds`, `policy_checked_at` and `access_mode`. Modes are `automatic`, `manual`, `disabled`; health is a separate `healthy`, `degraded`, `blocked` or `unknown` state. Native marketplace alerts remain outside this app unless the owner explicitly imports their content.

Integration order: verify a documented API and obtain access if needed; otherwise assess permitted public-page retrieval. Use a browser renderer only when ordinary rendering is permitted and required. Respect site terms, access controls, robots guidance and request limits. Do not use undocumented private endpoints as an assumed API, defeat CAPTCHAs, rotate identities to evade blocks, or import browser login cookies. A 401/403/challenge moves that collector to blocked/manual operation with a clear explanation.

Before enabling each automatic adapter, record the actual search URL template or API endpoint, supported filters, pagination, stable ID extraction, required permissions, review date, request budget and at least three sanitised representative detail fixtures. Unverified endpoints/selectors are not specified here as if they already work. Listing pages are untrusted content and cannot change application behaviour or configuration.

### 3.1 Blocket

- Generate searches for the tight and broad terms across Sweden, newest first where supported. Avoid requiring shipping filters at discovery because collection-only listings may still merit review after owner setup.
- Extract source ID, canonical URL, title, description, offer type, asking price, currency, status, location, disclosed condition, images and delivery options. Capture displayed buyer-protection/checkout costs when accessible and route-specific.
- Do not invent a fee formula. Prefer a displayed total or a documented, versioned applicable fee rule; unknown protection or shipping costs prevent a confirmed within-budget result.
- Native saved searches and app notifications can supplement the tracker; provide instructions and an Open source search button. The owner configures those in Blocket, and they do not automatically enter this app.
- Manual fallback: owner pastes an allowed Blocket listing URL and, if retrieval fails, price/description/delivery details. User-entered facts remain labelled and cannot be promoted to source-confirmed evidence.

### 3.2 Tradera

- Search tight/broad variants, photo categories where reliable, and both fixed-price and auction inventory. Extract source ID, seller listing type, price role, auction end, current bid, next valid bid/increment where available, reserve status, active Buy now price and delivery choices.
- Evaluate active Buy now and auction paths separately. Never treat a current bid, starting price, reserve or proposed offer as a payable fixed price. Buy now may disappear; recheck before issuing a budget alert.
- Capture the displayed price including protection when present. Mark it as inclusive; never add protection a second time. Otherwise compute using a versioned applicable fee rule and show it as an estimate pending a source-confirmed total.
- Reference reviewed on 8 November 2026: the standard Swedish protection fee is described as `2 SEK + 5% of order value`, capped at `499 SEK`, with category/country exceptions [S2]. Verify applicability, order-value basis and rounding before implementation; do not generalise exceptions to cameras.
- Native saved searches send email summaries [S3]. Offer setup guidance, but do not promise immediate native delivery or automatic ingestion.
- Auction output is always Auction watch, even when a bid is currently affordable. Compute a maximum affordable bid only when shipping, applicable fee rule and bid increments are known. If reserve information is absent, say so.

### 3.3 Fotosidan

- Discover from Köp&Sälj with tight/broad terms and sale-type filters where verified. Require a sale advert rather than wanted (`köpes`), exchange-only, rental or a forum discussion.
- Extract source ID, canonical URL, title, price, description, advert type, location, condition, status, seller profile link and delivery statements. Missing seller/shipping metadata stays unknown.
- Fotosidan permits links to Tradera auctions [S4]. A linked advert must not be classified as a direct fixed-price deal unless a distinct direct purchase route is explicitly offered. Validate the linked Tradera item, retain both source records, connect them by exact target item ID and use the Tradera price/cost/status for that auction route.
- Do not assume Fotosidan provides an API, RSS or native saved-search notifications. These capabilities require verification. During specification research the classifieds entry page returned HTTP 403 to the research client; this does not establish access from the production worker.
- Manual fallback is mandatory: Open source search, paste listing URL and optionally paste listing text with price/delivery evidence. No automatic-source freshness claim is made for a manually imported result.

### 3.4 Collection mechanics

The initial backfill walks newest results within a seven-day discovery window. If dates are missing, use a bounded page limit and label coverage partial. Source-specific limits established during qualification override the initial defaults: at most 10 result pages, 50 detail requests per run, one concurrent request per domain and at least two seconds between requests. An exhausted budget produces a cursor and `partial` status; later runs continue it. No claim of an exhaustive search is allowed.

Incremental runs use stable IDs, overlap the last successful discovery watermark by 24 hours and advance it only after successful pagination. Once daily, reconcile the seven-day window. Recheck saved or potentially eligible active listings for updates; active listings discovered earlier remain tracked even after the discovery window. Record `published_at` separately from `first_seen_at`; never invent publication time.

Search results create candidates. Detail retrieval qualifies them. A malformed response, parser/schema change, blocked request or empty unexpected layout is an error, not a successful empty result. Store source-specific run counts for discovered, new, updated, rejected, review-required and eligible results, plus truncation and errors.

## 4. Evidence and validation

Every critical field has `value`, `state`, `source_url`, `observed_at`, `method`, `evidence_excerpt` and `parser_version`. Field states are `source_observed`, `seller_claimed`, `user_reported`, `derived`, `unknown` and `conflicting`. Methods distinguish API, HTML, native-alert text import and manual input. A seller's description copied from a source is still a seller claim about physical condition or receipt ownership.

### Validation sequence

1. **Identity:** normalise case, spacing and punctuation. Match the whole model token `X100VI` or `X100 VI`; `X100V`, `X100F`, `X100T`, `X100S` and the original X100 do not qualify. `VI` must not pass an `X100V` prefix check.
2. **Object and intent:** establish that a camera is included and offered for sale. Accessories-only, empty box, wanted ads, rentals and repairs/services are rejected. A bundle with a camera remains valid. Negation matters: “inga fel” is not a fault; “fodral till X100VI” is not a camera. Ambiguous language goes to review rather than a naive keyword rejection.
3. **Model evidence:** explicit uncontradicted generation in a camera sale title/description is sufficient for a text-confirmed model. A broad X100 title alone requires review. Conflicting title, description or model label requires review. Images are supporting evidence; v1 does not assert automated visual confirmation.
4. **Condition:** explicit non-working, water-damaged or parts-only cameras are excluded from budget alerts. Seller-claimed working condition or the source's working-used condition category is sufficient for listing qualification, labelled accordingly. Missing or unclear functionality requires review. Shutter count and receipt are useful optional fields, not proof or required thresholds.
5. **Offer and availability:** classify fixed price, active Buy now, auction, negotiable asking price, exchange-only or unknown. Accept a negotiable asking price as payable only if it is an actual asking price; “offers from” needs review. Sold, ended and reserved listings are not currently actionable. An unavailable page alone is not proof of sale.
6. **Delivery and money:** validate SEK, Swedish domestic route, exact listed price role and required fees. A zero price or “1 kr” placeholder with a conflicting description goes to review. Reject foreign-currency routes from v1 qualification with a visible reason.
7. **Freshness:** before an automatic Within budget alert, successfully re-fetch details no more than five minutes before evaluation. If shipping/fees come from a different source, require evidence within the same window or a still-valid fee-rule version. If refresh is not allowed or fails, downgrade to Needs review.

Result classes are deterministic and include reason codes:

| Class | Conditions | External alert behaviour |
| --- | --- | --- |
| Within budget | Model/object/condition pass; active fixed route; all costs source-supported; fresh total strictly below budget; delivery eligible | Immediate enabled-channel alert |
| Needs review | Possible camera but critical evidence missing, estimated, stale, manual-only or conflicting | Dashboard; optional daily review digest |
| Auction watch | Live auction with plausible product match; current bid shown explicitly as provisional | Dashboard and opt-in ending reminder |
| Over budget | Valid fixed route but known total at or above limit | Dashboard only |
| Unavailable | Explicit sold/reserved/ended state | History; no deal alert |
| Rejected | Wrong model/object/intent, non-working, or unsupported geography/currency | Searchable diagnostics with reason |

Critical conflicts take priority over a low apparent price. Dashboard totals become visibly stale when freshness expires and are not presented as current. Source-observed availability means only what the page reported at the timestamp; checkout must be rechecked by the owner.

## 5. Full-cost engine

Use integer öre with decimal-safe parsing. Store each route separately:

```text
totalOre = itemOre + shippingOre + protectionOre + otherRequiredFeesOre
           + ownerTravelAllowanceOre  // collection routes only
eligible = allRequiredComponentsKnown && totalOre < budgetOre
```

V1 domestic SEK routes have no currency conversion or cross-border calculation. Explicitly recorded zero is different from null/unknown. A shipped route and a collection route cannot mix the cheapest components from each. Shipping must be to Sweden and a method actually offered for that item. Collection requires an owner-approved location and recorded travel allowance; an explicit zero allowance is allowed. Unknown shipping means unknown total. Record tax-inclusive price as given; never add VAT twice.

Represent `item_only`, `item_plus_protection` and `full_route_total` price bases. When the source displays an inclusive price, decompose only if the components reconcile; otherwise retain the inclusive amount and its scope. Ambiguous inclusion becomes Needs review. Explicit source quote beats a matching formula; a disagreement is recorded as a conflict requiring review. A formula-only result remains estimated, not a confirmed Within budget deal.

Fee rules have source, category, buyer country, seller type, route, effective dates, base definition, rounding strategy, cap, reference URL, last verification and version. Qualification must verify these details. Expire unverified rules after 30 days until rechecked; source-displayed current charges can still be used. Never silently omit a mandatory fee, reuse a stale discount, or deduct a coupon unavailable to this owner. Exclude optional financing and choose an ordinary supported payment route; instalment amounts are not purchase prices.

### Budget examples and required fixtures

All examples are synthetic. Fee values illustrate arithmetic, not universal fees.

| Input | Expected |
| --- | --- |
| 14,000 item + 59 shipping + 499 protection | 14,558 SEK; eligible if remaining validation passes |
| 14,500 + 59 + 499 | 15,058 SEK; Over budget |
| 14,400 + 101 + 499 | Exactly 15,000 SEK; Over budget |
| 14,400.99 + 100 + 499 | 14,999.99 SEK; within exclusive threshold |
| 14,000 with missing shipping | Unknown total; Needs review |
| 14,499 displayed including protection + 59 shipping | 14,558 SEK; do not add protection again |
| 14,900 local collection, approved location, explicit 0 travel | 14,900 SEK; eligible for that collection route only |
| 12,000 current bid | Auction watch; never a fixed-price bargain |

For an auction, find the largest permitted bid `b` such that `b + shipping + applicableFees(b) < budget`. Respect platform increments and the minimum next bid, and account for reserve status. Use a monotone integer search with boundary verification for supported fee rules. If the minimum valid bid exceeds the computed ceiling, show “No bid within budget.” Never place that bid. Unknown increments, fees or shipping mean no confirmed bid ceiling; an optional estimate must be visibly labelled. Recompute on every reminder.

## 6. User controls and search triggers

### Setup and watch editor

Authenticate the single owner using an allowlisted email identity through a maintained authentication library. Verify email ownership. Edit budget, source selection, condition preferences, acceptable collection locations, travel allowances and delivery channels. Show source capabilities before saving. Sources that require setup appear as manual or disabled, never silently active.

Save creates or revises a watch. **Search now** triggers one run immediately, whether monitoring is enabled or paused. **Enable monitoring** schedules recurring runs and performs an initial run. **Pause monitoring** stops future scheduled collection and queued unsent deal notifications for that watch; it does not cancel already delivered alerts or a manual run the owner explicitly starts. Settings changes trigger reevaluation of stored fresh records, but do not fetch new pages until a manual run or scheduled tick. Mark results derived from old settings as superseded.

### Trigger contract

| Trigger | Action and owner feedback |
| --- | --- |
| Search now | Return run ID immediately; show queued/running/completed/partial/failed states per source |
| Scheduled tick | Enqueue due automatic sources; display last successful and next scheduled check |
| Open source search | Open a validated marketplace search URL with equivalent supported terms; no claim of collection |
| Import listing | Paste allowed URL; attempt qualified detail fetch, or accept pasted fields as user-reported evidence |
| Recheck listing | Refresh one listing when source access allows; otherwise explain manual steps |
| Change watch criteria | Recompute matches from retained evidence, tag with watch revision and request a fresh check before alerts |
| Mark purchased | Stop monitoring and unsent notifications; retain history; explicitly resumable |

Use a durable queue with one active run per watch/source. Manual duplicate clicks return the active run ID. Coalesce scheduled work into that run; a manual request does not bypass request budgets, backoff or access restrictions. Within 15 seconds of the click, show queued status and then source progress when available. Do not block the HTTP request until collection finishes.

A run across three sources can complete two successfully and fail the third. Show “2 sources searched; Fotosidan needs manual input,” with counts and timestamps. Only show “No matches” for successful covered searches. Manual source shortcuts appear in the same run view, so the owner can finish coverage deliberately.

## 7. Results and notifications

Dashboard tabs: Within budget, Needs review, Auction watch, Over budget and Saved. Keep unavailable and rejected history accessible through filters. Each card/detail contains source, title, original URL, price role, status, full cost or known subtotal, unknown components, condition claim, location/delivery route, model evidence, warnings, first detected time and last checked time. Expandable evidence shows origin and timestamp for critical facts.

Use factual labels such as “seller claims receipt available” and “profile shows 12 reviews.” No trust score or “safe seller” badge. Do not automatically collect sensitive identity data. A low price alone does not prove fraud; it can prompt additional owner review.

External delivery is opt-in during setup. Email requires a verified destination and test send. Telegram requires a successful pairing challenge with the owner's chat; tokens stay server-side. Dashboard history is always available and does not require external delivery configuration. Native Blocket/Tradera notifications are separate, may duplicate tracker alerts, and cannot be suppressed by this app.

Immediate external alerts are sent on first Within budget qualification, a crossing from above budget/unknown to Within budget, or an eligible price reduction of at least 100 SEK since the last alerted price. Re-fetch details before eligibility and outbox creation. No repeated alert for an unchanged listing on repeated searches. A watch revision is recorded and cannot create duplicate first-match messages for otherwise unchanged eligibility. An owner can optionally enable a daily review/auction digest, default 18:00 in the watch timezone, and an auction reminder 30 minutes before end. Enable these separately; neither is on by default.

Example (synthetic):

```text
X100VI Silver — 14,558 SEK total — Blocket
Camera 14,000 + shipping 59 + protection 499
Used; seller states fully working. Shipping within Sweden.
Model: confirmed in listing text. Receipt: not stated.
Discovered 14:02; listing checked 14:03 Europe/Stockholm.
Open listing | Review evidence
Availability and condition still require your final check.
```

Do not call estimated or manually supplied totals confirmed. Review digest cards state missing facts and link to manual recheck. Notification actions open an authenticated app page or original source; they never purchase, submit a bid or message a seller. Sensitive tokens and source credentials never appear in URLs.

Persist evaluation and outbox entry in one database transaction. Deduplication key is `(watch_id, source, source_listing_id, qualifying_event_fingerprint, channel)` with a unique constraint. Use provider idempotency where available; delivery is at-least-once with best-effort duplicate suppression, not guaranteed exactly-once. Transient failures retry at 1, 5 and 15 minutes, then become visibly failed. Permanent recipient/authentication failures stop retries and show a channel problem. On retries recheck that the watch is active for notifications and the listing is still eligible; stale records require refresh or cancellation. Track pending, sent, cancelled and failed states independently from discovery.

## 8. Technical contracts and persistence

Proposed stack: TypeScript, Next.js web/API, separate Node.js worker, PostgreSQL and a PostgreSQL-backed durable job queue. Pin supported runtime/dependencies during scaffolding. Scheduled work runs in the worker and is independent of browser sessions or web request lifetimes.

```ts
type Source = 'blocket' | 'tradera' | 'fotosidan';
type Money = { amountOre: number; currency: 'SEK' };
type PriceRole = 'asking' | 'buy_now' | 'current_bid' | 'starting_bid' | 'unknown';
interface SourceAdapter {
  capabilities(): SourceCapabilities;
  buildSearches(watch: Watch): SourceQuery[];
  discover(query: SourceQuery, cursor?: string): Promise<DiscoveryPage>;
  fetchDetail(ref: ListingRef): Promise<ListingEvidence>;
  normalise(evidence: ListingEvidence): NormalisedListing;
}
```

Types above are design sketches; all referenced contracts require runtime schemas. Adapter errors distinguish blocked, rate_limited, temporary_failure, unsupported and parse_failure. Normalisation must not return an apparently empty page after an extraction failure. Use validated discriminated unions for offer, evidence, cost and availability states.

| Entity | Minimum fields / constraints |
| --- | --- |
| Owner / channel | Owner identity, verified destinations, pairing state, secret references |
| Watch | Budget öre, preferences, selected sources, monitoring state, revision, timezone |
| Source configuration | Capabilities, access mode, health, policy review, request budget, backoff, last success |
| Search run / source run | Trigger, watch revision, state, counts, pagination coverage, error, start/end and next check |
| Listing | Unique `(source, external_id)`, canonical URL, seller profile URL, offer/status/model fields, first/last seen |
| Evidence / observation | Per-field provenance, excerpts, parsed values, cost basis, timestamps, parser/rule version, content hash |
| Purchase route | Listing, delivery method, item/shipping/fees/travel, component evidence, total and certainty |
| Evaluation | Watch revision, listing observation, route, class and reason codes |
| Fee rule | Applicability, formula/base/rounding/cap, effective dates, verification and source reference |
| Notification / outbox | Unique event key, owner/channel, payload revision, attempts, provider reference and status |
| Listing relationship | Explicit cross-source target ID/URL or possible duplicate with supporting evidence |

Repeated source IDs update the same listing and append observations only for meaningful changes. Exact linked Tradera IDs can merge presentation and suppress duplicate event delivery. Similar title/image/price without an explicit link creates only a possible-duplicate hint; retain independent listings to avoid losing legitimate offers.

Proposed authenticated API:

| Method / route | Behaviour |
| --- | --- |
| `POST /api/watches` | Validate settings and create watch; monitoring off |
| `PATCH /api/watches/:id` | Update preferences/revision with optimistic concurrency |
| `POST /api/watches/:id/runs` | Manual run; idempotency key; 202 with run ID |
| `POST /api/watches/:id/monitoring` | Explicit enable/pause; idempotent desired state |
| `POST /api/watches/:id/purchased` | Stop monitoring/unsent notifications |
| `GET /api/runs/:id` | Per-source progress, errors and coverage |
| `GET /api/listings?watchId=...&class=...` | Paginated owner results |
| `POST /api/imports` | Validate source URL and optional pasted evidence; 202 with import ID |
| `POST /api/listings/:id/recheck` | Enqueue one permitted detail fetch |
| `GET /api/sources` | Actual capabilities, health and schedule |
| `POST /api/channels/:id/test` | Send one owner-requested test through a configured channel |

Use 400 for invalid inputs, 401/403 for unauthorised access and 429 for owner-trigger limits; return structured error codes. Check ownership on every object. Protect mutation requests against CSRF, limit import size and escape imported HTML. Restrict outbound requests to reviewed source hosts; allowlist each redirect target, block local/private/reserved addresses and validate DNS resolution at connection time to prevent SSRF. External auction links are accepted only as validated Tradera listing references, never arbitrary fetch URLs.

## 9. Operations and data handling

Use server-side environment variables for `DATABASE_URL`, `APP_BASE_URL`, `OWNER_EMAIL`, authentication secret, mail transport/provider configuration and optional Telegram token/chat reference. The final scaffold must document its exact names in `.env.example`. A missing email/Telegram configuration disables that channel visibly; it does not prevent dashboard use. No email-provider or Telegram account is assumed to exist today.

Respect `Retry-After`. For transient source failures use capped exponential backoff starting at one minute and capped at one hour, with jitter; stop repeated auth/challenge requests immediately. A domain circuit opens after three consecutive transient failures and allows one probe after 30 minutes. Report last successful search, last attempt, parser status and next attempt separately. Do not promise a 15-minute interval when a source limits collection more strictly.

Keep minimal listing metadata/history for 180 days after last activity, evidence excerpts for 30 days and transient raw parsing material for at most seven days. Do not persist full pages or images by default; add sanitised fixtures only after removing personal contact information and unrelated content. Redact secrets, pasted contact details and sensitive message content from logs. Provide owner export and deletion, daily database backups with 14-day retention, and document that deletion ages out of backups within that window.

Operational targets under normal permitted source access: manual-run acknowledgement within two seconds; progress visible within 15 seconds; normal bounded run finishes within three minutes, otherwise labelled still-running/partial; alert provider handoff within 60 seconds after successful qualification. These are implementation targets, not promises of listing discovery latency. Detection depends on source availability, permitted cadence, indexing and pagination coverage. Measure adapter errors, queue age, last success, eligible evaluations and delivery failures without logging private contents.

## 10. Build plan and acceptance criteria

### Phase 0: integration feasibility

Record access decisions, actual URL/query formats, filter semantics, rate limits and representative fixtures for each source. Qualify automatic collection or explicitly demonstrate the manual fallback. Recheck documentation/terms before launch. Automatic three-source coverage cannot be declared complete while any source remains manual.

### Phase 1: domain and cost engine

Implement runtime schemas, source-independent Swedish price parsing, validation reason codes, evidence precedence and route-based totals. Unit tests must exercise the budget examples, exact threshold and öre precision, fees already included, fee expiry, missing shipping, conflicting evidence, X100V versus VI, wanted/accessory/rental ads, negated defects, working bundles, stale availability and collection eligibility. Unit tests run entirely offline.

### Phase 2: owner dashboard and imports

Implement owner authentication, watch settings, explicit monitoring controls, source modes, manual imports and result/evidence views. End-to-end tests: save without scheduling; click Search now; see per-source progress; import blocked-source evidence into Needs review; revise budget; pause; mark purchased. Unauthenticated users cannot read results or trigger work. No credentials or contact data appear in HTML/logs.

### Phase 3: source adapters

Use sanitised fixture contract tests for discovery, pagination, details, deleted/ended items, malformed markup, blocked responses and empty results. Verify Blocket fee uncertainty never becomes zero, Tradera bid/Buy now/protection roles stay distinct, and linked Fotosidan auctions inherit the Tradera transaction route. Perform a bounded operator-triggered live smoke check for each automatic adapter and record source, timestamp and actual capabilities. No recurring live marketplace tests in CI.

### Phase 4: scheduler and persistence

Prove worker restart recovery, overlapping manual/scheduled request coalescing, successful-only watermark advancement, request budget truncation, retry/backoff, blocked-source isolation, observation deduplication and state changes on pause/purchase. Test that two successful sources and one failed source show partial coverage rather than a successful empty global search.

### Phase 5: delivery and release

Use stubbed email/Telegram providers to test first qualification, budget crossing, meaningful price reduction, repeated-run suppression, transactional outbox crash recovery, permanent channel failures and expiry on retry. Test auction reminders as opt-in with a fake clock and timezone/DST cases. Send a real test message only to the verified owner after channel setup. Run lint, typecheck, unit/integration tests, browser tests and production builds through documented scripts.

Release requires: accurate exclusive total checks; fresh evidence before qualifying automatic alerts; usable on-demand search and manual imports for all sources; clearly reported automatic/manual coverage; persistent monitoring when enabled; working configured delivery with dashboard history; and no automatic transaction actions. If automatic access is blocked for a source, the release notes must identify that limitation rather than implying completed automatic coverage.

## 11. References and unresolved checks

Reviewed 8 November 2026. These support product facts, not approval for automated access. External access rules and fee details require revalidation at implementation.

- **S1 — Blocket account and notification guidance:** https://www.blocket.se/inspiration/kom-igang-med-nya-blocket/mitt-blocket . Supports native saved-search/notification guidance; not an external API contract.
- **S2 — Tradera protection:** https://www.tradera.com/support/se/posts/traderas-koeparskydd/ . Supports the published standard fee and exceptions; applicability, fee base and rounding must be verified for the actual route.
- **S3 — Tradera buying guide:** https://www.tradera.com/how-to-buy . Distinguishes auctions/Buy now and describes saved-search email summaries.
- **S4 — Fotosidan advert rules:** https://whitebalance.zendesk.com/hc/sv/articles/360028052931-Regler-och-r%C3%A5d-f%C3%B6r-Fotosidan-K%C3%B6p-S%C3%A4lj . Supports sale-advert context and permitted Tradera auction links.
- **S5 — Fotosidan classifieds entry:** https://www.fotosidan.se/classifieds/ . Research client returned 403; public collection and native alert capabilities remain unverified.

Open implementation checks: permitted automatic access for each source; actual search/pagination/detail selectors; native notifications currently offered; source checkout/protection inclusion and delivery eligibility; exact fee rounding and bid increments; email provider and deployment host. Defaults and fallbacks above let the core app be built without pretending these integrations already exist.
