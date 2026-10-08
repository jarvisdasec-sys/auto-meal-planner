/** Shared types and adapters for the tiered food-image resolution pipeline. */

import type { PortionGuideKey } from '@/lib/imageFallback';
import { DEFAULT_FOOD_IMAGE } from '@/lib/imageFallback';

/** Grocery retailers for which the server can attempt an exact product image. */
export type StoreId = 'walmart' | 'kroger' | 'other';

/** Which tier produced the current candidate. Legacy generic source values remain readable. */
export type ImageSource =
  | 'curated'
  | 'store'
  | 'open_food_facts'
  | 'spoonacular'
  | 'unsplash'
  | 'portion_guide'
  | 'placeholder';

/** Canonical descriptor accepted by the resolver/API. */
export interface FoodItem {
  id: string;
  name: string;
  /** Canonical ingredient term. It is cache identity only unless an exact provider is enabled. */
  ingredientQuery?: string;
  /** UPC/EAN barcode used only for exact product matching. */
  upc?: string;
  /** Legacy catalog spelling; normalized to `upc` by `toFoodImageItem`. */
  barcode?: string;
  store?: StoreId;
  /** Retailer-specific exact product ID (Kroger productId, Walmart item ID). */
  storeProductId?: string;
  /** Already-known exact retailer/scan image. Never use an unvalidated arbitrary URL. */
  storeImageUrl?: string;
  portionGuide?: PortionGuideKey;
  imageUrl?: string;
  imageSource?: ImageSource;
}

/** Looser app-facing shape accepted by the one shared catalog/nutrition adapter. */
export interface FoodImageItemInput {
 id?: unknown;
 name?: unknown;
 barcode?: unknown;
 upc?: unknown;
 store?: unknown;
 storeProductId?: unknown;
 storeImageUrl?: unknown;
 imageUrl?: unknown;
 ingredientQuery?: unknown;
 portionGuide?: unknown;
 imageSource?: unknown;
}

export interface ResolvedFoodImage {
  id: string;
  url: string;
  source: ImageSource;
}

/** Local, always-available image shipped with the app. */
export const LOCAL_PLACEHOLDER_IMAGE = DEFAULT_FOOD_IMAGE;

export function normalizeUpc(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const upc = value.trim();
  return /^\d{6,14}$/.test(upc) ? upc : undefined;
}

function clippedString(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().slice(0, max);
  return normalized || undefined;
}

/**
 * Adapt catalog (`barcode`) and scanned/custom (`upc`) records to the resolver
 * contract. Callers should pass this descriptor through unchanged to `FoodImage`.
 */
export function toFoodImageItem(input: FoodImageItemInput): FoodItem | undefined {
  const id = clippedString(input.id, 128);
  const name = clippedString(input.name, 200);
  if (!id || !name) return undefined;

  const store = input.store === 'walmart' || input.store === 'kroger' || input.store === 'other' ? input.store : undefined;
  const portionGuide =
    input.portionGuide === 'palm' ||
    input.portionGuide === 'fist' ||
    input.portionGuide === 'cupped_hand' ||
    input.portionGuide === 'thumb' ||
    input.portionGuide === 'thumb_tip'
      ? input.portionGuide
      : undefined;

  return {
    id,
    name,
    ingredientQuery: clippedString(input.ingredientQuery, 200),
    // `upc` wins when both fields exist; catalog barcode remains a compatibility alias.
    upc: normalizeUpc(input.upc) ?? normalizeUpc(input.barcode),
    store,
    storeProductId: clippedString(input.storeProductId, 128),
    storeImageUrl: clippedString(input.storeImageUrl, 2048) ?? clippedString(input.imageUrl, 2048),
    portionGuide,
  };
}
