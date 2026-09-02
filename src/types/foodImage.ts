/**
 * Shared types for the tiered food-image resolution pipeline.
 */

import type { PortionGuideKey } from '@/lib/imageFallback';
import { DEFAULT_FOOD_IMAGE } from '@/lib/imageFallback';

/** Grocery retailers we can resolve a first-party product photo for. */
export type StoreId = 'walmart' | 'kroger' | 'other';

/** Which tier of the fallback hierarchy produced the image. */
export type ImageSource =
  | 'store'
  | 'open_food_facts'
  | 'spoonacular'
  | 'unsplash'
  | 'portion_guide'
  | 'placeholder';

export interface FoodItem {
  id: string;
  /** Display / query name, e.g. "Boneless Chicken Breast". */
  name: string;
  /** Canonical ingredient term used for generic image search (tier 3). */
  ingredientQuery?: string;
  /** UPC / EAN barcode used for the Open Food Facts lookup (tier 2). */
  upc?: string;
  /** Retailer this item was priced/sourced from. */
  store?: StoreId;
  /** Retailer-specific product identifier (Kroger productId, Walmart item id). */
  storeProductId?: string;
  /** Direct retailer CDN image URL, when already known (tier 1, no network call). */
  storeImageUrl?: string;
  /** Hand-measurement guide; drives the macro-accurate tier 4 fallback. */
  portionGuide?: PortionGuideKey;
  /** Resolved image, populated by the resolver. */
  imageUrl?: string;
  imageSource?: ImageSource;
}

export interface ResolvedFoodImage {
  id: string;
  url: string;
  source: ImageSource;
}

/** Local, always-available image shipped with the app. */
export const LOCAL_PLACEHOLDER_IMAGE = DEFAULT_FOOD_IMAGE;
