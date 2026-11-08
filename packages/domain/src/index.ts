import { z } from 'zod';

export const sources = ['blocket', 'tradera', 'fotosidan'] as const;
export type Source = (typeof sources)[number];
export const SourceSchema = z.enum(sources);
export const moneyLimit = 100_000_000; // Safety bound: 1 million SEK.
export function parseSEK(input: string): number {
  let value = input
    .trim()
    .replace(/\u00a0|\u202f/g, ' ')
    .replace(/\s*(?:SEK|kr)\.?\s*$/i, '')
    .replace(/:-$/, '')
    .trim();
  // Swedish decimal comma and optional strict thousands separators.
  if (!/^(?:\d+|\d{1,3}(?: \d{3})+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(value)) {
    throw new Error('Enter a Swedish amount, for example 14 500 or 14 500,50.');
  }
  value = value.replace(/[ .]/g, '');
  const [whole, fraction = ''] = value.split(',');
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > moneyLimit)
    throw new Error('Amount is out of range.');
  return amount;
}
export const amountInput = z
  .string()
  .max(40)
  .transform((s, ctx) => {
    try {
      return parseSEK(s);
    } catch (error) {
      ctx.addIssue({ code: 'custom', message: (error as Error).message });
      return z.NEVER;
    }
  });
const optionalAmount = z
  .string()
  .max(40)
  .transform((v, ctx): number | null => {
    if (!v.trim()) return null;
    try {
      return parseSEK(v);
    } catch (error) {
      ctx.addIssue({ code: 'custom', message: (error as Error).message });
      return z.NEVER;
    }
  });
export function formatSEK(amount: number): string {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: 'SEK',
    maximumFractionDigits: amount % 100 ? 2 : 0,
  }).format(amount / 100);
}
export const WatchInput = z.object({
  name: z.string().trim().min(1).max(100),
  budget: amountInput.refine((v) => v > 0, 'Budget must be positive.'),
  sources: z.array(SourceSchema).min(1),
  collectionLocations: z.string().trim().max(500).default(''),
});
export function canonicalListingUrl(raw: string): {
  source: Source;
  externalId: string;
  url: string;
} {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Enter a full marketplace listing URL.');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port)
    throw new Error('Use a public HTTPS marketplace listing URL.');
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  let source: Source, id: string | undefined;
  if (host === 'blocket.se') {
    source = 'blocket';
    id =
      url.pathname.match(/^\/recommerce\/forsale\/item\/(\d+)\/?$/)?.[1] ??
      url.pathname.match(/^\/annons\/(?:[^/]+\/)*?(\d+)\/?$/)?.[1];
  } else if (host === 'tradera.com') {
    source = 'tradera';
    id = url.pathname.match(/^\/(?:[a-z]{2}\/)?item\/\d+\/(\d+)(?:\/[^/]+)?\/?$/)?.[1];
  } else if (host === 'fotosidan.se') {
    source = 'fotosidan';
    id = url.pathname.match(/^\/classifieds\/(?:view|viewitem|viewad)\.htm$/)
      ? (url.searchParams.get('ID') ?? url.searchParams.get('id') ?? undefined)
      : undefined;
    if (!id) id = url.pathname.match(/^\/classifieds\/(\d+)(?:\/[^/]+)?\/?$/)?.[1];
  } else throw new Error('Use a Blocket, Tradera or Fotosidan listing URL.');
  if (!id || !/^\d{1,20}$/.test(id))
    throw new Error('Use an individual listing URL with a marketplace item ID.');
  url.hash = '';
  url.search = source === 'fotosidan' && url.pathname.endsWith('.htm') ? `?ID=${id}` : '';
  return { source, externalId: id, url: url.toString() };
}
export const ListingInput = z
  .object({
    watchId: z.string().uuid(),
    url: z.string().trim().max(2048),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().min(1).max(10000),
    model: z.enum(['x100vi', 'other', 'unknown']),
    intent: z.enum(['camera_sale', 'accessory', 'wanted', 'rental', 'unknown']),
    condition: z.enum(['working', 'nonworking', 'unknown']),
    availability: z.enum(['active', 'reserved', 'sold', 'ended', 'unknown']),
    offer: z.enum(['asking', 'buy_now', 'auction', 'unknown']),
    currency: z.enum(['SEK', 'other']),
    country: z.enum(['SE', 'other', 'unknown']),
    price: amountInput,
    priceBasis: z.enum(['item_only', 'item_plus_protection', 'full_route_total']),
    route: z.enum(['shipping', 'collection']),
    shipping: optionalAmount,
    protection: optionalAmount,
    otherFees: optionalAmount,
    travel: optionalAmount,
    location: z.string().trim().max(200),
    notes: z.string().trim().max(2000).default(''),
  })
  .superRefine((data, ctx) => {
    try {
      canonicalListingUrl(data.url);
    } catch (error) {
      ctx.addIssue({ code: 'custom', path: ['url'], message: (error as Error).message });
    }
  });
export type ListingData = z.output<typeof ListingInput>;
export type EvidenceOrigin = 'user_reported' | 'source_observed';
export type EvaluationClass =
  | 'Within budget'
  | 'Needs review'
  | 'Auction watch'
  | 'Over budget'
  | 'Unavailable'
  | 'Rejected';
export type Evidence = {
  origin: EvidenceOrigin;
  observedAt: string;
  sourceUrl: string;
  method: 'manual_import' | 'qualified_adapter';
  excerpt: string;
};
export type Evaluation = {
  class: EvaluationClass;
  reasons: string[];
  totalOre: number | null;
  knownSubtotalOre: number;
  budgetStatus: 'below' | 'at_or_above' | 'unknown';
  components: { label: string; amountOre: number | null }[];
  ruleVersion: string;
  evidenceOrigin: EvidenceOrigin;
  evaluatedAt: string;
};
export function evaluate(
  data: ListingData,
  watch: { budget: number; collectionLocations: string },
  evidence: Evidence,
  now = new Date(),
): Evaluation {
  const reasons: string[] = [];
  const components: { label: string; amountOre: number | null }[] = [
    {
      label:
        data.priceBasis === 'full_route_total'
          ? 'Reported route total'
          : data.priceBasis === 'item_plus_protection'
            ? 'Camera + protection'
            : 'Camera',
      amountOre: data.price,
    },
  ];
  if (data.priceBasis !== 'full_route_total') {
    if (data.route === 'shipping') components.push({ label: 'Shipping', amountOre: data.shipping });
    if (data.priceBasis === 'item_only')
      components.push({ label: 'Buyer protection', amountOre: data.protection });
    components.push({ label: 'Other required fees', amountOre: data.otherFees });
  }
  if (data.route === 'collection')
    components.push({ label: 'Travel allowance', amountOre: data.travel });
  const knownSubtotalOre = components.reduce((n, c) => n + (c.amountOre ?? 0), 0);
  const totalOre =
    data.currency === 'SEK' && components.every((c) => c.amountOre !== null)
      ? knownSubtotalOre
      : null;
  const budgetStatus =
    totalOre === null ? 'unknown' : totalOre < watch.budget ? 'below' : 'at_or_above';
  const base = {
    totalOre,
    knownSubtotalOre,
    budgetStatus,
    components,
    ruleVersion: '1.0.0',
    evidenceOrigin: evidence.origin,
    evaluatedAt: now.toISOString(),
  } as const;
  const output = (classification: EvaluationClass): Evaluation => ({
    ...base,
    class: classification,
    reasons,
  });
  const text = `${data.title}\n${data.description}`.normalize('NFKC').toLowerCase();
  const exact = /\bx\s?100\s?vi\b/i.test(text);
  const older = /\bx\s?100\s?(?:v|f|t|s)\b/i.test(text);
  if (data.model === 'other') reasons.push('WRONG_MODEL');
  if (['accessory', 'wanted', 'rental'].includes(data.intent)) reasons.push('NOT_CAMERA_SALE');
  if (data.condition === 'nonworking') reasons.push('NONWORKING');
  if (data.currency !== 'SEK' || data.country === 'other')
    reasons.push('UNSUPPORTED_REGION_OR_CURRENCY');
  if (reasons.length) return output('Rejected');
  if (['sold', 'ended', 'reserved'].includes(data.availability)) {
    reasons.push('NOT_AVAILABLE');
    return output('Unavailable');
  }
  // Positive/negative statements must not silently overrule a contradictory pasted advert.
  const wanted = /(?:^|\n)\s*(?:köpes|wanted|looking for|söker)\b/i.test(text);
  const accessoryTitle =
    /^(?:(?:smallrig|fuji(?:film)?)\s+)?(?:fodral|case|väska|lens hood|motljusskydd|tomkartong|empty box)\b/i.test(
      data.title.trim(),
    );
  const broken = /\b(?:trasig|defekt|reservdelar|non[- ]working|for parts)\b/i.test(
    text
      .replace(/\b(?:inte|ej)\s+(?:trasig|defekt)\b/g, '')
      .replace(/\b(?:no|not)\s+(?:defect|non-working)\b/g, ''),
  );
  if (!exact || older || data.model !== 'x100vi') reasons.push('MODEL_UNCONFIRMED_OR_CONFLICTING');
  if (wanted || accessoryTitle || broken) reasons.push('DESCRIPTION_CONFLICT');
  if (data.intent !== 'camera_sale') reasons.push('SALE_INTENT_UNKNOWN');
  if (data.condition !== 'working') reasons.push('WORKING_CONDITION_UNKNOWN');
  if (data.availability !== 'active') reasons.push('AVAILABILITY_UNKNOWN');
  if (data.offer === 'unknown') reasons.push('PRICE_ROLE_UNKNOWN');
  if (data.country === 'unknown') reasons.push('COUNTRY_UNKNOWN');
  if (data.price <= 100) reasons.push('POSSIBLE_PLACEHOLDER_PRICE');
  const approvedLocations = watch.collectionLocations
    .split(/[,;\n]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (
    data.route === 'collection' &&
    (!data.location || !approvedLocations.includes(data.location.toLowerCase()))
  )
    reasons.push('COLLECTION_LOCATION_NOT_APPROVED');
  if (totalOre === null) reasons.push('COSTS_MISSING');
  if (evidence.origin === 'user_reported') reasons.push('MANUAL_EVIDENCE_REQUIRES_SOURCE_CHECK');
  const age = now.getTime() - new Date(evidence.observedAt).getTime();
  if (!Number.isFinite(age) || age < 0 || age > 300_000) reasons.push('EVIDENCE_STALE');
  if (data.offer === 'auction') {
    reasons.push('BID_IS_NOT_PURCHASE_PRICE');
    return output(
      reasons.some((r) =>
        [
          'MODEL_UNCONFIRMED_OR_CONFLICTING',
          'DESCRIPTION_CONFLICT',
          'SALE_INTENT_UNKNOWN',
        ].includes(r),
      )
        ? 'Needs review'
        : 'Auction watch',
    );
  }
  if (reasons.length) return output('Needs review');
  return output(budgetStatus === 'below' ? 'Within budget' : 'Over budget');
}
export const reasonLabels: Record<string, string> = {
  WRONG_MODEL: 'This is a different camera model.',
  NOT_CAMERA_SALE: 'This is not an offer to sell a camera.',
  NONWORKING: 'The camera is reported as non-working.',
  UNSUPPORTED_REGION_OR_CURRENCY: 'Only Swedish domestic listings priced in SEK are supported.',
  NOT_AVAILABLE: 'The listing is sold, reserved or ended.',
  MODEL_UNCONFIRMED_OR_CONFLICTING:
    'Confirm the VI generation; listing text is missing or conflicting.',
  DESCRIPTION_CONFLICT: 'The advert text conflicts with the supplied sale or condition details.',
  SALE_INTENT_UNKNOWN: 'Confirm a camera is included and offered for sale.',
  WORKING_CONDITION_UNKNOWN: 'Confirm the camera works.',
  AVAILABILITY_UNKNOWN: 'Confirm current availability.',
  PRICE_ROLE_UNKNOWN: 'Confirm whether this is an asking price or a bid.',
  COUNTRY_UNKNOWN: 'Confirm the seller is in Sweden.',
  POSSIBLE_PLACEHOLDER_PRICE: 'This may be a placeholder price.',
  COLLECTION_LOCATION_NOT_APPROVED:
    'Add this exact collection location to your watch to approve the route.',
  COSTS_MISSING: 'One or more required costs are unknown.',
  MANUAL_EVIDENCE_REQUIRES_SOURCE_CHECK:
    'These details are user-reported. Check the original listing before buying.',
  EVIDENCE_STALE:
    'The original evidence is over five minutes old; re-evaluation does not refresh it.',
  BID_IS_NOT_PURCHASE_PRICE: 'The amount is a current bid, not a price you can buy at.',
};
export function searchUrl(source: Source): string {
  return {
    blocket: 'https://www.blocket.se/recommerce/forsale/search?q=X100VI',
    tradera: 'https://www.tradera.com/search?q=X100VI',
    fotosidan: 'https://www.fotosidan.se/classifieds/',
  }[source];
}
