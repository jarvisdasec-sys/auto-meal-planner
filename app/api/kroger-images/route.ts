import { NextResponse } from 'next/server';

import { getKrogerProductImage, searchKrogerProductByUPC } from '@/lib/krogerApi';
import { sanitizeRemoteUrl } from '@/lib/imageHosts';
import { normalizeUpc } from '@/types/foodImage';

export const runtime = 'nodejs';

const MAX_FOODS = 25;
const MAX_CONCURRENT_LOOKUPS = 3;

interface KrogerImageRequestFood {
  id: string;
  upc?: string;
  barcode?: string;
  store?: 'kroger';
  storeProductId?: string;
}

function error(message: string, status = 400) {
  return NextResponse.json({ error: message, images: {} }, { status });
}

function parseFood(raw: unknown): KrogerImageRequestFood | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const id = typeof value.id === 'string' ? value.id.trim().slice(0, 128) : '';
  if (!id) return null;
  const upc = normalizeUpc(value.upc) ?? normalizeUpc(value.barcode);
  const productId = typeof value.storeProductId === 'string' ? value.storeProductId.trim().slice(0, 128) : undefined;
  const store = value.store === 'kroger' ? 'kroger' : undefined;
  return { id, upc, storeProductId: productId, store };
}

async function resolveExactKrogerImage(food: KrogerImageRequestFood): Promise<string | undefined> {
  if (food.store === 'kroger' && food.storeProductId) {
    const byProductId = sanitizeRemoteUrl(await getKrogerProductImage(food.storeProductId));
    if (byProductId) return byProductId;
  }
  if (!food.upc) return undefined;
  const product = await searchKrogerProductByUPC(food.upc);
  // The adapter itself checks this, and the route repeats it before returning data.
  if (!product || product.upc !== food.upc) return undefined;
  return sanitizeRemoteUrl(product.imageUrl);
}

/**
 * Legacy store-enrichment endpoint. It accepts barcode as a UPC compatibility
 * alias but never makes a name search: a first fuzzy result is not product identity.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error('Invalid JSON body.');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return error('Body must be an object.');
  const rawFoods = (body as { foods?: unknown }).foods;
  if (!Array.isArray(rawFoods)) return error('`foods` must be an array.');
  if (rawFoods.length > MAX_FOODS) return error(`At most ${MAX_FOODS} foods are allowed.`, 413);

  const foods = rawFoods.map(parseFood);
  if (foods.some((food) => !food)) return error('Foods must be valid image descriptors.');
  const validFoods = foods as KrogerImageRequestFood[];
  if (new Set(validFoods.map((food) => food.id)).size !== validFoods.length) {
    return error('Duplicate food IDs are not allowed.');
  }

  const images: Record<string, string> = {};
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(MAX_CONCURRENT_LOOKUPS, validFoods.length) }, async () => {
      while (cursor < validFoods.length) {
        const food = validFoods[cursor++];
        try {
          const url = await resolveExactKrogerImage(food);
          if (url) images[food.id] = url;
        } catch {
          // Optional provider failures leave this food untouched.
        }
      }
    }),
  );
  return NextResponse.json({ images });
}
