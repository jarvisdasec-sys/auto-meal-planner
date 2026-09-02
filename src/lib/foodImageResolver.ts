/**
 * Tiered food image resolver (server-only).
 *
 * Resolution order, first hit wins:
 *   1. Store CDN     — an explicit `storeImageUrl`, or a live Kroger product lookup.
 *   2. UPC match     — Open Food Facts, when the item carries a barcode.
 *   3. Generic       — Spoonacular ingredient art, then Unsplash photography.
 *   4. Portion guide — the macro-accurate hand-portion graphic for the item.
 *   5. Local         — a static placeholder bundled with the app.
 *
 * Every tier is failure-tolerant: a network error, missing API key, or empty
 * result silently demotes to the next tier rather than throwing.
 */

import { getFallbackForPortionGuide } from './imageFallback';
import { sanitizeRemoteUrl } from './imageHosts';
import { searchKrogerProductByName, searchKrogerProductByUPC } from './krogerApi';
import {
  LOCAL_PLACEHOLDER_IMAGE,
  type FoodItem,
  type ImageSource,
  type ResolvedFoodImage,
} from '@/types/foodImage';

const SPOONACULAR_API_KEY = process.env.SPOONACULAR_API_KEY ?? '';
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY ?? '';

const FETCH_TIMEOUT_MS = 4000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const cache = new Map<string, { value: ResolvedFoodImage; expiresAt: number }>();

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

/** Tier 1 — retailer CDN. */
async function resolveFromStore(item: FoodItem): Promise<string | undefined> {
  const direct = sanitizeRemoteUrl(item.storeImageUrl);
  if (direct) return direct;

  if (item.store !== 'kroger') return undefined;

  const byUpc = item.upc ? await searchKrogerProductByUPC(item.upc) : null;
  const fromUpc = sanitizeRemoteUrl(byUpc?.imageUrl);
  if (fromUpc) return fromUpc;

  const [byName] = await searchKrogerProductByName(item.name, 1);
  return sanitizeRemoteUrl(byName?.imageUrl);
}

/** Tier 2 — Open Food Facts UPC match. */
async function resolveFromOpenFoodFacts(item: FoodItem): Promise<string | undefined> {
  const upc = item.upc?.trim();
  if (!upc || !/^\d{6,14}$/.test(upc)) return undefined;

  const data = await fetchJson(`https://world.openfoodfacts.org/api/v0/product/${upc}.json`);
  const payload = data as { status?: number; product?: Record<string, unknown> } | null;
  if (!payload || payload.status !== 1 || !payload.product) return undefined;

  const product = payload.product;
  return (
    sanitizeRemoteUrl(product.image_front_url) ??
    sanitizeRemoteUrl(product.image_url) ??
    sanitizeRemoteUrl(product.image_front_small_url)
  );
}

/** Tier 3a — Spoonacular canonical ingredient art. */
async function resolveFromSpoonacular(query: string): Promise<string | undefined> {
  if (!SPOONACULAR_API_KEY) return undefined;

  const data = await fetchJson(
    `https://api.spoonacular.com/food/ingredients/search?query=${encodeURIComponent(query)}&number=1&apiKey=${encodeURIComponent(SPOONACULAR_API_KEY)}`,
  );
  const results = (data as { results?: Array<{ image?: string }> } | null)?.results;
  const image = results?.[0]?.image;
  if (!image) return undefined;

  return sanitizeRemoteUrl(`https://img.spoonacular.com/ingredients_500x500/${image}`);
}

/** Tier 3b — Unsplash photography. */
async function resolveFromUnsplash(query: string): Promise<string | undefined> {
  if (!UNSPLASH_ACCESS_KEY) return undefined;

  const data = await fetchJson(
    `https://api.unsplash.com/search/photos?per_page=1&content_filter=high&orientation=squarish&query=${encodeURIComponent(`${query} food`)}&client_id=${encodeURIComponent(UNSPLASH_ACCESS_KEY)}`,
  );
  const results = (data as { results?: Array<{ urls?: { regular?: string } }> } | null)?.results;
  return sanitizeRemoteUrl(results?.[0]?.urls?.regular);
}

function cacheKey(item: FoodItem): string {
  return [item.store ?? '', item.upc ?? '', item.ingredientQuery ?? item.name].join('|').toLowerCase();
}

/** Sources that represent a real photo of the food, as opposed to a stand-in graphic. */
const REAL_PHOTO_SOURCES: ReadonlySet<ImageSource> = new Set<ImageSource>([
  'store',
  'open_food_facts',
  'spoonacular',
  'unsplash',
]);

/** Resolve a single item through the full hierarchy. Never throws. */
export async function resolveFoodImage(item: FoodItem): Promise<ResolvedFoodImage> {
  const key = cacheKey(item);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return { ...cached.value, id: item.id };

  const query = (item.ingredientQuery ?? item.name).trim();
  const tiers: Array<[ImageSource, () => Promise<string | undefined>]> = [
    ['store', () => resolveFromStore(item)],
    ['open_food_facts', () => resolveFromOpenFoodFacts(item)],
    ['spoonacular', () => resolveFromSpoonacular(query)],
    ['unsplash', () => resolveFromUnsplash(query)],
    ['portion_guide', async () => getFallbackForPortionGuide(item.portionGuide)],
  ];

  let resolved: ResolvedFoodImage = {
    id: item.id,
    url: LOCAL_PLACEHOLDER_IMAGE,
    source: 'placeholder',
  };

  for (const [source, run] of tiers) {
    let url: string | undefined;
    try {
      url = await run();
    } catch {
      url = undefined;
    }
    if (url) {
      resolved = { id: item.id, url, source };
      break;
    }
  }

  // Only cache real photos so a transient outage doesn't pin a stand-in graphic for a day.
  if (REAL_PHOTO_SOURCES.has(resolved.source)) {
    cache.set(key, { value: resolved, expiresAt: Date.now() + CACHE_TTL_MS });
  }

  return resolved;
}

/** Resolve many items concurrently, keyed by `FoodItem.id`. */
export async function resolveFoodImages(items: FoodItem[]): Promise<Record<string, ResolvedFoodImage>> {
  const results = await Promise.all(items.map((item) => resolveFoodImage(item)));
  return Object.fromEntries(results.map((result) => [result.id, result]));
}
