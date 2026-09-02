import { NextResponse } from 'next/server';

import { resolveFoodImages } from '@/lib/foodImageResolver';
import { PORTION_GUIDE_FALLBACKS, type PortionGuideKey } from '@/lib/imageFallback';
import { LOCAL_PLACEHOLDER_IMAGE, type FoodItem, type StoreId } from '@/types/foodImage';

export const runtime = 'nodejs';

const MAX_ITEMS = 25;
const STORES: StoreId[] = ['walmart', 'kroger', 'other'];
const PORTION_GUIDES = Object.keys(PORTION_GUIDE_FALLBACKS) as PortionGuideKey[];

function toFoodItem(raw: unknown): FoodItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;

  const id = typeof value.id === 'string' ? value.id.slice(0, 128) : '';
  const name = typeof value.name === 'string' ? value.name.trim().slice(0, 200) : '';
  if (!id || !name) return null;

  const store = STORES.find((candidate) => candidate === value.store);
  const portionGuide = PORTION_GUIDES.find((candidate) => candidate === value.portionGuide);

  return {
    id,
    name,
    store,
    portionGuide,
    ingredientQuery:
      typeof value.ingredientQuery === 'string' ? value.ingredientQuery.trim().slice(0, 200) : undefined,
    upc: typeof value.upc === 'string' && /^\d{6,14}$/.test(value.upc.trim()) ? value.upc.trim() : undefined,
    storeProductId: typeof value.storeProductId === 'string' ? value.storeProductId.slice(0, 64) : undefined,
    storeImageUrl: typeof value.storeImageUrl === 'string' ? value.storeImageUrl.slice(0, 2048) : undefined,
  };
}

/**
 * POST /api/food-images
 * Body: { items: FoodItem[] }
 * Returns: { images: Record<string, { url, source }> }
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const rawItems = (body as { items?: unknown })?.items;
  if (!Array.isArray(rawItems)) {
    return NextResponse.json({ error: '`items` must be an array.' }, { status: 400 });
  }

  const items = rawItems.slice(0, MAX_ITEMS).map(toFoodItem).filter((item): item is FoodItem => item !== null);
  if (items.length === 0) {
    return NextResponse.json({ images: {} });
  }

  try {
    const images = await resolveFoodImages(items);
    return NextResponse.json({ images });
  } catch {
    // Never fail the UI over an image lookup — degrade to the local placeholder.
    const images = Object.fromEntries(
      items.map((item) => [item.id, { id: item.id, url: LOCAL_PLACEHOLDER_IMAGE, source: 'placeholder' }]),
    );
    return NextResponse.json({ images });
  }
}
