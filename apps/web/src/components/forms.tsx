'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveWatchAction, importAction } from '@/app/actions';
import { sources, type ListingData } from '@tracker/domain';
import type { Watch, Listing } from '@tracker/db';
const asAmount = (n: number | null | undefined) =>
  n === null || n === undefined ? '' : String(n / 100).replace('.', ',');
export function WatchForm({ watch }: { watch?: Watch }) {
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <form
      className="form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        start(async () => {
          const result = await saveWatchAction(form);
          if (result.error) setError(result.error);
          else {
            router.push(`/?watch=${result.id}`);
            router.refresh();
          }
        });
      }}
    >
      {watch && (
        <>
          <input type="hidden" name="id" value={watch.id} />
          <input type="hidden" name="revision" value={watch.revision} />
        </>
      )}
      <label>
        Watch name
        <input name="name" required maxLength={100} defaultValue={watch?.name ?? 'My X100VI'} />
      </label>
      <label>
        Total budget · SEK
        <input
          name="budget"
          required
          inputMode="decimal"
          defaultValue={asAmount(watch?.budget ?? 1500000)}
        />
        <small>
          The total must be strictly below this amount, including delivery and required fees.
        </small>
      </label>
      <fieldset>
        <legend>Sources</legend>
        <div className="source-choices">
          {sources.map((source) => (
            <label className="checkbox" key={source}>
              <input
                name="sources"
                type="checkbox"
                value={source}
                defaultChecked={watch?.sources.includes(source) ?? true}
              />
              <span className="capitalize">{source}</span>
              <small>Manual imports</small>
            </label>
          ))}
        </div>
      </fieldset>
      <label>
        Approved collection locations
        <input
          name="collectionLocations"
          defaultValue={watch?.collection_locations ?? ''}
          placeholder="Stockholm, Uppsala"
          maxLength={500}
        />
        <small>
          Comma-separated exact locations. Leave blank for shipping only. Collection also needs a
          travel allowance.
        </small>
      </label>
      <div className="notice">
        Saving a watch does not start monitoring. Automatic searches and notifications will be added
        in the next build.
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="button" disabled={pending}>
        {pending ? 'Saving…' : watch ? 'Save watch' : 'Create watch →'}
      </button>
    </form>
  );
}
function Select({
  name,
  label,
  options,
  value,
}: {
  name: string;
  label: string;
  options: [string, string][];
  value: string;
}) {
  return (
    <label>
      {label}
      <select name={name} defaultValue={value}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
export function ImportForm({
  watches,
  listing,
  watchId,
}: {
  watches: Watch[];
  listing?: Listing;
  watchId?: string;
}) {
  const d: Partial<ListingData> = listing?.data ?? {};
  const router = useRouter();
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const [basis, setBasis] = useState(d.priceBasis ?? 'item_only');
  const [route, setRoute] = useState(d.route ?? 'shipping');
  return (
    <form
      className="form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        start(async () => {
          const result = await importAction(form);
          if (result.error) setError(result.error);
          else {
            router.push(`/?watch=${form.get('watchId')}&listing=${result.id}`);
            router.refresh();
          }
        });
      }}
    >
      {listing && <input name="revision" type="hidden" value={listing.revision} />}
      {listing ? (
        <input name="watchId" type="hidden" value={listing.watch_id} />
      ) : (
        <label>
          Watch
          <select name="watchId" defaultValue={watchId ?? watches[0]?.id}>
            {watches.map((w) => (
              <option value={w.id} key={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        Original listing URL
        <input
          name="url"
          type="url"
          required
          maxLength={2048}
          readOnly={!!listing}
          defaultValue={listing?.url}
          placeholder="https://www.tradera.com/item/…"
        />
        <small>
          Individual Blocket, Tradera or Fotosidan advert. We store your supplied evidence; no page
          is fetched.
        </small>
      </label>
      <label>
        Listing title
        <input name="title" required maxLength={200} defaultValue={d.title} />
      </label>
      <label>
        Listing description
        <textarea
          name="description"
          rows={5}
          required
          maxLength={10000}
          defaultValue={d.description}
        />
        <small>
          Paste the relevant advert text. Omit phone numbers, addresses and other personal details.
        </small>
      </label>
      <div className="form-grid">
        <Select
          name="model"
          label="Camera generation"
          value={d.model ?? 'unknown'}
          options={[
            ['unknown', 'Not confirmed'],
            ['x100vi', 'X100VI (VI generation)'],
            ['other', 'Different model'],
          ]}
        />
        <Select
          name="intent"
          label="What is being offered?"
          value={d.intent ?? 'unknown'}
          options={[
            ['unknown', 'Not confirmed'],
            ['camera_sale', 'Camera for sale (bundles OK)'],
            ['accessory', 'Accessory / empty box'],
            ['wanted', 'Wanted advert'],
            ['rental', 'Rental'],
          ]}
        />
        <Select
          name="condition"
          label="Functionality stated in listing"
          value={d.condition ?? 'unknown'}
          options={[
            ['unknown', 'Not stated / unclear'],
            ['working', 'Seller says working'],
            ['nonworking', 'Non-working / for parts'],
          ]}
        />
        <Select
          name="availability"
          label="Availability"
          value={d.availability ?? 'unknown'}
          options={[
            ['unknown', 'Not confirmed'],
            ['active', 'Available'],
            ['reserved', 'Reserved'],
            ['sold', 'Sold'],
            ['ended', 'Ended'],
          ]}
        />
        <Select
          name="offer"
          label="Price type"
          value={d.offer ?? 'unknown'}
          options={[
            ['unknown', 'Not confirmed'],
            ['asking', 'Fixed / asking price'],
            ['buy_now', 'Active Buy now'],
            ['auction', 'Current auction bid'],
          ]}
        />
        <Select
          name="country"
          label="Seller country"
          value={d.country ?? 'unknown'}
          options={[
            ['unknown', 'Not confirmed'],
            ['SE', 'Sweden'],
            ['other', 'Outside Sweden'],
          ]}
        />
        <Select
          name="currency"
          label="Currency"
          value={d.currency ?? 'SEK'}
          options={[
            ['SEK', 'SEK'],
            ['other', 'Other (not supported)'],
          ]}
        />
        <label>
          Displayed amount
          <input
            name="price"
            required
            inputMode="decimal"
            defaultValue={asAmount(d.price)}
            placeholder="14 000"
          />
        </label>
      </div>
      <fieldset>
        <legend>Full purchase cost</legend>
        <p className="muted">
          Leave unknown costs blank. Enter 0 only when the amount is explicitly zero. Include the
          whole bundle price.
        </p>
        <div className="form-grid">
          <label>
            What does the displayed amount include?
            <select
              name="priceBasis"
              value={basis}
              onChange={(e) => setBasis(e.target.value as typeof basis)}
            >
              <option value="item_only">Camera only</option>
              <option value="item_plus_protection">Camera + buyer protection</option>
              <option value="full_route_total">Full route total incl. shipping & fees</option>
            </select>
          </label>
          <label>
            Delivery route
            <select
              name="route"
              value={route}
              onChange={(e) => setRoute(e.target.value as typeof route)}
            >
              <option value="shipping">Shipping within Sweden</option>
              <option value="collection">Local collection</option>
            </select>
          </label>
          <label>
            Shipping · SEK
            <input
              name="shipping"
              inputMode="decimal"
              disabled={basis === 'full_route_total' || route === 'collection'}
              defaultValue={asAmount(d.shipping)}
              placeholder="Unknown"
            />
          </label>
          <label>
            Buyer protection · SEK
            <input
              name="protection"
              inputMode="decimal"
              disabled={basis !== 'item_only'}
              defaultValue={asAmount(d.protection)}
              placeholder="Unknown"
            />
          </label>
          <label>
            Other required fees · SEK
            <input
              name="otherFees"
              inputMode="decimal"
              disabled={basis === 'full_route_total'}
              defaultValue={asAmount(d.otherFees)}
              placeholder="Unknown"
            />
          </label>
          <label>
            Travel allowance · SEK
            <input
              name="travel"
              inputMode="decimal"
              disabled={route !== 'collection'}
              defaultValue={asAmount(d.travel)}
              placeholder="Unknown"
            />
          </label>
          <label>
            Collection location / listed city
            <input
              name="location"
              maxLength={200}
              defaultValue={d.location ?? ''}
              placeholder="Stockholm"
            />
          </label>
        </div>
      </fieldset>
      <label>
        Your evidence notes
        <textarea
          name="notes"
          rows={2}
          maxLength={2000}
          defaultValue={d.notes ?? ''}
          placeholder="Where did you find the shipping or fee amount?"
        />
      </label>
      <div className="notice">
        These facts will be labelled user-reported. A low total remains Needs review until a source
        check can confirm the details. Re-importing updates this listing and keeps its observation
        history.
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button className="button" disabled={pending}>
        {pending ? 'Validating…' : listing ? 'Update evidence & validate →' : 'Import & validate →'}
      </button>
    </form>
  );
}
