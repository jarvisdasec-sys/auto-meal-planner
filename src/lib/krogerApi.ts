/**
 * Server-only Kroger product adapter. It intentionally exposes only exact product
 * identity operations to the image resolver; callers must not treat a fuzzy name
 * search's first result as the requested food.
 */

import { normalizeUpc } from '@/types/foodImage';

const KROGER_BASE_URL = 'https://api.kroger.com/v1';
const KROGER_TOKEN_URL = 'https://api.kroger.com/v1/connect/oauth2/token';
const REQUEST_TIMEOUT_MS = 4_000;

// KROGER_CLIENT_ID is the server-safe setting. The NEXT_PUBLIC spelling is read
// only as a legacy compatibility fallback; no value is ever returned to clients.
const KROGER_CLIENT_ID = process.env.KROGER_CLIENT_ID ?? process.env.NEXT_PUBLIC_KROGER_CLIENT_ID ?? '';
const KROGER_CLIENT_SECRET = process.env.KROGER_CLIENT_SECRET ?? '';

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

export interface KrogerProduct {
  productId: string;
  upc: string;
  name: string;
  brand?: string;
  imageUrl?: string;
  description?: string;
  caloriesPerServing?: number;
}

interface KrogerApiImage {
  perspective?: string;
  featured?: boolean;
  sizes?: Array<{ size?: string; url?: string }>;
}

interface KrogerApiProduct {
  productId?: string;
  upc?: string;
  name?: string;
  brand?: string;
  description?: string;
  images?: KrogerApiImage[];
  nutrition?: { calories?: number };
}

function requestSignal(): AbortSignal {
  return AbortSignal.timeout(REQUEST_TIMEOUT_MS);
}

function getKrogerImageUrl(images?: KrogerApiImage[]): string | undefined {
  if (!images?.length) return undefined;
  const preferred =
    images.find((image) => image.featured && image.perspective === 'front') ??
    images.find((image) => image.perspective === 'front') ??
    images[0];
  return (
    preferred.sizes?.find((size) => size.size === 'xlarge')?.url ??
    preferred.sizes?.find((size) => size.size === 'large')?.url ??
    preferred.sizes?.[0]?.url
  );
}

function toKrogerProduct(value: KrogerApiProduct): KrogerProduct | null {
  const productId = typeof value.productId === 'string' ? value.productId : '';
  const upc = normalizeUpc(value.upc);
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  if (!productId || !upc || !name) return null;
  return {
    productId,
    upc,
    name,
    brand: typeof value.brand === 'string' ? value.brand : undefined,
    imageUrl: getKrogerImageUrl(value.images),
    description: typeof value.description === 'string' ? value.description : undefined,
    caloriesPerServing: typeof value.nutrition?.calories === 'number' ? value.nutrition.calories : undefined,
  };
}

/** Get a cached OAuth token, or null when the optional provider is unavailable. */
export async function getKrogerAccessToken(): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.accessToken;
  if (!KROGER_CLIENT_ID || !KROGER_CLIENT_SECRET) return null;

  try {
    const response = await fetch(KROGER_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${KROGER_CLIENT_ID}:${KROGER_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'product.compact' }).toString(),
      signal: requestSignal(),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { access_token?: unknown; expires_in?: unknown };
    if (typeof data.access_token !== 'string' || !data.access_token) return null;
    const expiresIn = typeof data.expires_in === 'number' && Number.isFinite(data.expires_in) ? data.expires_in : 300;
    cachedToken = {
      accessToken: data.access_token,
      expiresAt: Date.now() + Math.max(30, expiresIn - 60) * 1000,
    };
    return cachedToken.accessToken;
  } catch {
    return null;
  }
}

async function fetchProducts(path: string): Promise<KrogerApiProduct[]> {
  const token = await getKrogerAccessToken();
  if (!token) return [];
  try {
    const response = await fetch(`${KROGER_BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: requestSignal(),
    });
    if (!response.ok) return [];
    const data = (await response.json()) as { data?: unknown };
    return Array.isArray(data.data) ? (data.data as KrogerApiProduct[]) : [];
  } catch {
    return [];
  }
}

/**
 * Exact UPC lookup. Kroger can return multiple products even with filter.upc, so
 * the product's returned UPC is checked before any image/product data is exposed.
 */
export async function searchKrogerProductByUPC(upcInput: string): Promise<KrogerProduct | null> {
  const upc = normalizeUpc(upcInput);
  if (!upc) return null;
  const products = await fetchProducts(`/products?filter.upc=${encodeURIComponent(upc)}`);
  for (const raw of products) {
    const product = toKrogerProduct(raw);
    if (product && product.upc === upc) return product;
  }
  return null;
}

/**
 * Search remains available for UI suggestion features, but consumers must apply
 * `isExactKrogerNameMatch`; image enrichment intentionally does not use it.
 */
export async function searchKrogerProductByName(productName: string, limit = 5): Promise<KrogerProduct[]> {
  const term = productName.trim().slice(0, 200);
  if (!term) return [];
  const boundedLimit = Math.max(1, Math.min(Math.floor(limit) || 1, 10));
  const products = await fetchProducts(
    `/products?filter.term=${encodeURIComponent(term)}&filter.limit=${boundedLimit}`,
  );
  return products.map(toKrogerProduct).filter((product): product is KrogerProduct => product !== null);
}

/** Conservative normalized equality; similarity is deliberately not a match. */
export function normalizeKrogerProductName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function isExactKrogerNameMatch(requestedName: string, product: Pick<KrogerProduct, 'name'>): boolean {
  const requested = normalizeKrogerProductName(requestedName);
  return Boolean(requested) && requested === normalizeKrogerProductName(product.name);
}

/** Get an image by the caller's exact Kroger product ID. */
export async function getKrogerProductImage(productId: string): Promise<string | null> {
  const id = productId.trim();
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(id)) return null;
  const token = await getKrogerAccessToken();
  if (!token) return null;
  try {
    const response = await fetch(`${KROGER_BASE_URL}/products/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: requestSignal(),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { data?: { images?: KrogerApiImage[] } };
    return getKrogerImageUrl(data.data?.images) ?? null;
  } catch {
    return null;
  }
}

/**
 * Legacy utility retained for callers that explicitly request exact UPC enrichment.
 * It never performs name matching and only writes URLs returned for the same UPC.
 */
export async function enrichFoodsWithKrogerImages(
  foods: Array<{ barcode?: string; upc?: string; imageUrl?: string }>,
): Promise<void> {
  for (const food of foods) {
    const upc = normalizeUpc(food.upc) ?? normalizeUpc(food.barcode);
    if (!upc) continue;
    const product = await searchKrogerProductByUPC(upc);
    if (product?.imageUrl) food.imageUrl = product.imageUrl;
  }
}
