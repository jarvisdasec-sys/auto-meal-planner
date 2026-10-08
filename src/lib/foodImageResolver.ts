/**
 * Server-only, identity-preserving food image resolver.
 *
 * The resolver deliberately does not use first-result generic image searches. A
 * photo is returned only when it is curated locally or tied to an exact store
 * product/UPC; otherwise the component receives an honestly labelled guide or
 * placeholder fallback.
 */

import { getCuratedFoodPhoto } from './foodPhotos';
import { getFallbackForPortionGuide } from './imageFallback';
import { sanitizeRemoteUrl } from './imageHosts';
import { getKrogerProductImage, searchKrogerProductByUPC } from './krogerApi';
import {
  LOCAL_PLACEHOLDER_IMAGE,
  normalizeUpc,
  type FoodItem,
  type ImageSource,
  type ResolvedFoodImage,
} from '@/types/foodImage';

const FETCH_TIMEOUT_MS = 4_000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 200;
const MAX_CONCURRENT_RESOLUTIONS = 4;

type CacheEntry = { value: Omit<ResolvedFoodImage, 'id'>; expiresAt: number };
const cache = new Map<string, CacheEntry>();

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: 'application/json' },
      next: { revalidate: 60 * 60 * 24 },
    });
    if (!response.ok) return null;
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

/** Exact tier 0 — a parent-curated local photograph for a known seed food. */
function resolveCurated(item: FoodItem): string | undefined {
  return sanitizeRemoteUrl(getCuratedFoodPhoto(item));
}

/** Exact tier 1 — explicit direct URL, then Kroger product ID, then verified UPC. */
async function resolveFromStore(item: FoodItem): Promise<string | undefined> {
  const direct = sanitizeRemoteUrl(item.storeImageUrl);
  if (direct) return direct;

  if (item.store !== 'kroger') return undefined;

  if (item.storeProductId) {
    const fromProductId = sanitizeRemoteUrl(await getKrogerProductImage(item.storeProductId));
    if (fromProductId) return fromProductId;
  }

  const upc = normalizeUpc(item.upc) ?? normalizeUpc(item.barcode);
  if (!upc) return undefined;
  const product = await searchKrogerProductByUPC(upc);
  // Defense in depth: adapter validates this too, but never accept a product whose
  // returned UPC differs from the requested identity.
  if (!product || product.upc !== upc) return undefined;
  return sanitizeRemoteUrl(product.imageUrl);
}

/** Exact tier 2 — Open Food Facts response must echo the requested UPC. */
async function resolveFromOpenFoodFacts(item: FoodItem): Promise<string | undefined> {
  const upc = normalizeUpc(item.upc) ?? normalizeUpc(item.barcode);
  if (!upc) return undefined;

  const data = await fetchJson(`https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(upc)}.json`);
  const payload = data as { status?: unknown; product?: Record<string, unknown> } | null;
  if (!payload || payload.status !== 1 || !payload.product) return undefined;

  const productUpc = normalizeUpc(payload.product.code) ?? normalizeUpc(payload.product._id);
  if (productUpc !== upc) return undefined;
  return (
    sanitizeRemoteUrl(payload.product.image_front_url) ??
    sanitizeRemoteUrl(payload.product.image_url) ??
    sanitizeRemoteUrl(payload.product.image_front_small_url)
  );
}

/**
 * Cache identity intentionally includes every exact or semantic discriminator.
 * This prevents same-name foods with distinct store URLs/product IDs/guides from
 * ever sharing a previous item's resolved photo.
 */
export function foodImageCacheKey(item: FoodItem): string {
  return JSON.stringify({
    id: item.id,
    name: item.name.trim().toLocaleLowerCase('en-US'),
    query: (item.ingredientQuery ?? '').trim().toLocaleLowerCase('en-US'),
    upc: normalizeUpc(item.upc) ?? normalizeUpc(item.barcode) ?? '',
    store: item.store ?? '',
    storeProductId: item.storeProductId ?? '',
    directUrl: sanitizeRemoteUrl(item.storeImageUrl) ?? '',
    portionGuide: item.portionGuide ?? '',
  });
}

function readCache(key: string, itemId: string): ResolvedFoodImage | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return undefined;
  }
  // Map insertion order is our LRU order.
  cache.delete(key);
  cache.set(key, entry);
  return { id: itemId, ...entry.value };
}

function writeCache(key: string, resolved: ResolvedFoodImage): void {
  cache.delete(key);
  cache.set(key, {
    value: { url: resolved.url, source: resolved.source },
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  while (cache.size > MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value as string);
}

/** Sources that are verified food photographs rather than local fallbacks. */
const REAL_PHOTO_SOURCES: ReadonlySet<ImageSource> = new Set<ImageSource>([
  'curated',
  'store',
  'open_food_facts',
]);

/** Resolve one item through curated and exact-identity tiers. Never throws. */
export async function resolveFoodImage(item: FoodItem): Promise<ResolvedFoodImage> {
  const key = foodImageCacheKey(item);
  const cached = readCache(key, item.id);
  if (cached) return cached;

  const tiers: Array<[ImageSource, () => Promise<string | undefined>]> = [
    ['store', () => resolveFromStore(item)],
    ['open_food_facts', () => resolveFromOpenFoodFacts(item)],
    ['curated', async () => resolveCurated(item)],
    ['portion_guide', async () => getFallbackForPortionGuide(item.portionGuide)],
  ];

  let resolved: ResolvedFoodImage = { id: item.id, url: LOCAL_PLACEHOLDER_IMAGE, source: 'placeholder' };
  for (const [source, run] of tiers) {
    try {
      const url = await run();
      if (url) {
        resolved = { id: item.id, url, source };
        break;
      }
    } catch {
      // Optional provider failures intentionally continue to the honest fallback.
    }
  }

  if (REAL_PHOTO_SOURCES.has(resolved.source)) writeCache(key, resolved);
  return resolved;
}

/** Resolve many cards with a small fixed worker pool rather than unbounded fan-out. */
export async function resolveFoodImages(items: FoodItem[]): Promise<Record<string, ResolvedFoodImage>> {
  const results: Record<string, ResolvedFoodImage> = {};
  let cursor = 0;
  const workerCount = Math.min(MAX_CONCURRENT_RESOLUTIONS, items.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (cursor < items.length) {
        const item = items[cursor++];
        results[item.id] = await resolveFoodImage(item);
      }
    }),
  );
  return results;
}

/** Test-only cache reset; not used by application code. */
export function clearFoodImageCacheForTests(): void {
  cache.clear();
}
