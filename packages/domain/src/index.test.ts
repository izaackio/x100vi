import { describe, it, expect } from 'vitest';
import { parseSEK, canonicalListingUrl, ListingInput, evaluate, type Evidence } from './index';
const now = new Date('2026-11-08T12:00:00Z');
const evidence: Evidence = {
  origin: 'source_observed',
  method: 'qualified_adapter',
  observedAt: now.toISOString(),
  sourceUrl: 'https://www.tradera.com/item/342564/123456789/x100vi',
  excerpt: 'Fujifilm X100VI, fully working',
};
const watch = { budget: 1500000, collectionLocations: 'Stockholm, Uppsala' };
const fixture = () =>
  ListingInput.parse({
    watchId: 'c4fc04af-ab0b-45a7-bde5-a06be95e8d78',
    url: evidence.sourceUrl,
    title: 'Fujifilm X100VI Silver',
    description: 'Fully working camera, no defects. Inga fel. Includes case.',
    model: 'x100vi',
    intent: 'camera_sale',
    condition: 'working',
    availability: 'active',
    offer: 'asking',
    country: 'SE',
    currency: 'SEK',
    price: '14000',
    priceBasis: 'item_only',
    route: 'shipping',
    shipping: '59',
    protection: '499',
    otherFees: '0',
    travel: '',
    location: 'Stockholm',
    notes: '',
  });
describe('Swedish money parser', () => {
  it.each([
    ['14 500 kr', 1450000],
    ['14\u00a0500:-', 1450000],
    ['14.500,00 SEK', 1450000],
    ['14 999,99', 1499999],
    ['0', 0],
    ['59,5', 5950],
  ])('parses %s', (input, value) => expect(parseSEK(input)).toBe(value));
  it.each([
    '14,500',
    '14.50',
    '14 50',
    '-1',
    '1e4',
    'Infinity',
    '15000 USD',
    '14,50,00',
    '1000001',
    '',
  ])('rejects ambiguous or unsupported %s', (input) => expect(() => parseSEK(input)).toThrow());
});
describe('source references', () => {
  it.each([
    [
      'https://www.tradera.com/item/342564/123456789/x100vi?utm_campaign=test',
      'tradera',
      '123456789',
    ],
    ['https://www.blocket.se/recommerce/forsale/item/123456', 'blocket', '123456'],
    ['https://www.blocket.se/annons/stockholm/fujifilm/123456', 'blocket', '123456'],
    ['https://www.fotosidan.se/classifieds/view.htm?ID=12345', 'fotosidan', '12345'],
  ])('extracts %s', (url, source, id) =>
    expect(canonicalListingUrl(url)).toMatchObject({ source, externalId: id }),
  );
  it.each([
    'http://www.tradera.com/item/1/2',
    'https://tradera.com.evil.test/item/1/2',
    'https://user:pass@tradera.com/item/1/2',
    'https://127.0.0.1/item/1/2',
    'https://tradera.com:444/item/1/2',
    'https://www.blocket.se/recommerce/forsale/search?q=X100VI',
    'https://www.fotosidan.se/classifieds/',
  ])('rejects unsafe/non-listing URL %s', (url) =>
    expect(() => canonicalListingUrl(url)).toThrow(),
  );
});
describe('route budget validation', () => {
  it('qualifies fresh fully supported evidence at 14558 SEK', () =>
    expect(evaluate(fixture(), watch, evidence, now)).toMatchObject({
      class: 'Within budget',
      totalOre: 1455800,
      budgetStatus: 'below',
    }));
  it.each([
    [1450000, 5900, 49900, 1505800],
    [1440000, 10100, 49900, 1500000],
  ])('rejects cost at/above threshold', (price, shipping, protection, totalOre) =>
    expect(
      evaluate({ ...fixture(), price, shipping, protection }, watch, evidence, now),
    ).toMatchObject({ class: 'Over budget', totalOre }),
  );
  it('keeps a single öre below the exclusive threshold', () =>
    expect(
      evaluate({ ...fixture(), price: 1440099, shipping: 10000 }, watch, evidence, now),
    ).toMatchObject({ class: 'Within budget', totalOre: 1499999 }));
  it('does not double-count inclusive protection', () =>
    expect(
      evaluate(
        { ...fixture(), price: 1449900, priceBasis: 'item_plus_protection', protection: 49900 },
        watch,
        evidence,
        now,
      ).totalOre,
    ).toBe(1455800));
  it('does not add shipping/fees twice to a full route total', () =>
    expect(
      evaluate(
        { ...fixture(), price: 1455800, priceBasis: 'full_route_total' },
        watch,
        evidence,
        now,
      ).totalOre,
    ).toBe(1455800));
  it('keeps missing costs unknown rather than free', () =>
    expect(evaluate({ ...fixture(), shipping: null }, watch, evidence, now)).toMatchObject({
      class: 'Needs review',
      totalOre: null,
      budgetStatus: 'unknown',
    }));
  it('requires approved collection location and explicit travel', () => {
    expect(
      evaluate(
        { ...fixture(), route: 'collection', price: 1490000, protection: 0, travel: 0 },
        watch,
        evidence,
        now,
      ).class,
    ).toBe('Within budget');
    expect(
      evaluate(
        { ...fixture(), route: 'collection', travel: 0, location: 'Malmö' },
        watch,
        evidence,
        now,
      ).class,
    ).toBe('Needs review');
    expect(
      evaluate({ ...fixture(), route: 'collection', travel: null }, watch, evidence, now).totalOre,
    ).toBeNull();
  });
});
describe('product and evidence rules', () => {
  it('keeps manually supplied facts in review even below budget', () =>
    expect(
      evaluate(
        fixture(),
        watch,
        { ...evidence, origin: 'user_reported', method: 'manual_import' },
        now,
      ),
    ).toMatchObject({ class: 'Needs review', budgetStatus: 'below' }));
  it('requires fresh evidence, not just a new evaluation time', () =>
    expect(
      evaluate(fixture(), watch, { ...evidence, observedAt: '2026-11-08T11:54:59Z' }, now).reasons,
    ).toContain('EVIDENCE_STALE'));
  it('does not accept a future timestamp', () =>
    expect(
      evaluate(fixture(), watch, { ...evidence, observedAt: '2026-11-09T12:00:00Z' }, now).class,
    ).toBe('Needs review'));
  it.each(['Fujifilm X100V', 'Fujifilm X100F', 'Fujifilm X100'])(
    'does not prefix-match %s',
    (title) =>
      expect(
        evaluate(
          { ...fixture(), title, description: 'Camera for sale, fully working.' },
          watch,
          evidence,
          now,
        ).class,
      ).toBe('Needs review'),
  );
  it('flags contradictory generations', () =>
    expect(
      evaluate(
        { ...fixture(), description: 'Actually Fujifilm X100V, not VI.' },
        watch,
        evidence,
        now,
      ).class,
    ).toBe('Needs review'));
  it('does not confuse negated defects with faults', () =>
    expect(evaluate(fixture(), watch, evidence, now).class).toBe('Within budget'));
  it('flags text that contradicts a sale selection', () =>
    expect(
      evaluate({ ...fixture(), title: 'Köpes Fujifilm X100VI' }, watch, evidence, now).reasons,
    ).toContain('DESCRIPTION_CONFLICT'));
  it('flags accessory-only titles', () =>
    expect(
      evaluate({ ...fixture(), title: 'Fodral till Fujifilm X100VI' }, watch, evidence, now).class,
    ).toBe('Needs review'));
  it.each([
    { model: 'other' as const },
    { intent: 'accessory' as const },
    { intent: 'wanted' as const },
    { intent: 'rental' as const },
    { condition: 'nonworking' as const },
    { currency: 'other' as const },
    { country: 'other' as const },
  ])('rejects unsupported object or route %o', (change) =>
    expect(evaluate({ ...fixture(), ...change }, watch, evidence, now).class).toBe('Rejected'),
  );
  it.each(['sold', 'reserved', 'ended'] as const)('does not alert %s listings', (availability) =>
    expect(evaluate({ ...fixture(), availability }, watch, evidence, now).class).toBe(
      'Unavailable',
    ),
  );
  it('keeps current bids out of fixed-price deals', () =>
    expect(
      evaluate({ ...fixture(), offer: 'auction', price: 1200000 }, watch, evidence, now),
    ).toMatchObject({ class: 'Auction watch' }));
  it('keeps the full bundle cost', () =>
    expect(
      evaluate(
        {
          ...fixture(),
          description: 'Fully working X100VI camera, case and three batteries included.',
        },
        watch,
        evidence,
        now,
      ).totalOre,
    ).toBe(1455800));
});
