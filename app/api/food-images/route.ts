import { NextResponse } from 'next/server';

import { resolveFoodImages } from '@/lib/foodImageResolver';
import { LOCAL_PLACEHOLDER_IMAGE, toFoodImageItem, type FoodImageItemInput, type FoodItem } from '@/types/foodImage';

export const runtime = 'nodejs';

const MAX_ITEMS = 25;

function badRequest(message: string, status = 400) {
  return NextResponse.json({ error: message, images: {} }, { status });
}

function parseItems(value: unknown): FoodItem[] | null {
  if (!Array.isArray(value)) return null;
  if (value.length > MAX_ITEMS) return null;
  const items = value.map((raw) => toFoodImageItem(raw as FoodImageItemInput));
  if (items.some((item) => !item)) return null;
  const resolved = items as FoodItem[];
  if (new Set(resolved.map((item) => item.id)).size !== resolved.length) return null;
  return resolved;
}

/**
 * POST /api/food-images
 * Body: `{ items: FoodImageItemInput[] }`; `barcode` is accepted as a legacy UPC
 * alias. Invalid, oversized, and duplicate batches are rejected before resolution.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('Invalid JSON body.');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return badRequest('Body must be an object.');

  const rawItems = (body as { items?: unknown }).items;
  if (!Array.isArray(rawItems)) return badRequest('`items` must be an array.');
  if (rawItems.length > MAX_ITEMS) return badRequest(`At most ${MAX_ITEMS} items are allowed.`, 413);

  const items = parseItems(rawItems);
  if (!items) return badRequest('Items must be valid, unique food-image descriptors.');
  if (items.length === 0) return NextResponse.json({ images: {} });

  try {
    return NextResponse.json({ images: await resolveFoodImages(items) });
  } catch {
    // A provider failure must not make an image endpoint fail the card request.
    return NextResponse.json({
      images: Object.fromEntries(
        items.map((item) => [item.id, { id: item.id, url: LOCAL_PLACEHOLDER_IMAGE, source: 'placeholder' }]),
      ),
    });
  }
}
