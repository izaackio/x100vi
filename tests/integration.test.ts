import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ListingInput } from '../packages/domain/src/index';
import {
  pool,
  saveWatch,
  importListing,
  enqueue,
  workOnce,
  getDashboard,
} from '../packages/db/src/index';
const owner = 'integration@example.test';
let watchId: string;
beforeAll(async () => {
  watchId = (
    await saveWatch(owner, {
      name: 'Integration watch',
      budget: 1500000,
      sources: ['blocket', 'tradera', 'fotosidan'],
      collectionLocations: '',
    })
  ).id;
});
afterAll(async () => {
  await pool.query('DELETE FROM watches WHERE owner_email=$1', [owner]);
  await pool.end();
});
const listing = () =>
  ListingInput.parse({
    watchId,
    url: 'https://www.tradera.com/item/342564/999999999/synthetic-x100vi',
    title: 'Synthetic Fujifilm X100VI',
    description: 'Test fixture only. Working camera.',
    model: 'x100vi',
    intent: 'camera_sale',
    condition: 'working',
    availability: 'active',
    offer: 'asking',
    currency: 'SEK',
    country: 'SE',
    price: '14000',
    priceBasis: 'item_only',
    route: 'shipping',
    shipping: '59',
    protection: '499',
    otherFees: '0',
    travel: '',
    location: '',
    notes: 'Synthetic integration test.',
  });
describe('PostgreSQL owner workflow', () => {
  it('persists evidence, deduplicates imports and retains observations', async () => {
    const id = await importListing(owner, listing());
    const again = await importListing(owner, { ...listing(), price: 1410000 });
    expect(again).toBe(id);
    const dashboard = await getDashboard(owner);
    expect(dashboard.listings).toHaveLength(1);
    expect(dashboard.listings[0].revision).toBe(2);
    expect(dashboard.listings[0].evaluation.class).toBe('Needs review');
    expect(dashboard.listings[0].evidence.origin).toBe('user_reported');
    expect(
      Number(
        (await pool.query('SELECT count(*) FROM observations WHERE listing_id=$1', [id])).rows[0]
          .count,
      ),
    ).toBe(2);
  });
  it('checks ownership for imports, jobs and edits', async () => {
    await expect(importListing('other@example.test', listing())).rejects.toThrow('Watch not found');
    await expect(enqueue('other@example.test', watchId)).rejects.toThrow('Watch not found');
    await expect(
      saveWatch('other@example.test', {
        id: watchId,
        expectedRevision: 1,
        name: 'Stolen',
        budget: 1,
        sources: ['tradera'],
        collectionLocations: '',
      }),
    ).rejects.toThrow();
    expect((await getDashboard('other@example.test')).listings).toHaveLength(0);
  });
  it('coalesces duplicate jobs and rechecks without refreshing evidence timestamps', async () => {
    const id = (await getDashboard(owner)).listings[0].id;
    const before = (await getDashboard(owner)).listings[0].evidence.observedAt;
    const [a, b] = await Promise.all([enqueue(owner, watchId, id), enqueue(owner, watchId, id)]);
    expect(a).toBe(b);
    await workOnce();
    const dashboard = await getDashboard(owner);
    expect(dashboard.jobs.find((j) => j.id === a)?.state).toBe('completed');
    expect(
      dashboard.jobs
        .find((j) => j.id === a)
        ?.result?.sources.every((s) => s.state === 'manual_required'),
    ).toBe(true);
    expect(dashboard.listings[0].evidence.observedAt).toBe(before);
  });
  it('re-evaluates on budget changes and rejects stale edits', async () => {
    await saveWatch(owner, {
      id: watchId,
      expectedRevision: 1,
      name: 'New budget',
      budget: 1400000,
      sources: ['tradera'],
      collectionLocations: '',
    });
    expect((await getDashboard(owner)).listings[0].evaluation.budgetStatus).toBe('at_or_above');
    await expect(
      saveWatch(owner, {
        id: watchId,
        expectedRevision: 1,
        name: 'Stale',
        budget: 1500000,
        sources: ['tradera'],
        collectionLocations: '',
      }),
    ).rejects.toThrow('changed in another window');
    const data = (await getDashboard(owner)).listings[0];
    await expect(importListing(owner, listing(), data.revision - 1)).rejects.toThrow(
      'changed in another window',
    );
  });
});
