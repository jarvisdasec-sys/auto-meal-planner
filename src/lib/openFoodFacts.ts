import type { Allergen } from './fitnessMealPlanner';
import { sanitizeRemoteUrl } from './imageHosts';

const OFF_REQUEST_TIMEOUT_MS = 8_000;
const BARCODE_PATTERN = /^\d{8,14}$/;
const KNOWN_ALLERGENS: readonly Allergen[] = [
  'peanuts', 'tree_nuts', 'milk', 'eggs', 'fish', 'shellfish', 'soy', 'wheat', 'sesame',
];

export type OpenFoodFactsNutritionBasis = 'serving' | '100g';

export interface OpenFoodFactsNutrition {
  /** Nutrition values all use this one explicit basis; values are never mixed across bases. */
  basis: OpenFoodFactsNutritionBasis;
  label: string;
  calories: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
}

export interface OpenFoodFactsProduct {
  barcode: string;
  name: string;
  /** Legacy 100 g fields remain available for existing consumers. */
  caloriesPer100g: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
  imageUrl?: string;
  ingredients?: string[];
  allergens?: Allergen[];
  servingSize?: string;
  servingQuantity?: number;
  nutrition: OpenFoodFactsNutrition;
}

export type OpenFoodFactsLookupResult =
  | { status: 'found'; product: OpenFoodFactsProduct }
  | { status: 'not_found' }
  | { status: 'failed'; message: string };

function nonNegativeNumber(value: unknown): number {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function parseAllergens(value: unknown): Allergen[] | undefined {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];
  const allergens = raw
    .map((entry) => String(entry).trim().toLowerCase().replace(/^[a-z]{2}:/, '').replace(/[\s-]+/g, '_'))
    .filter((entry): entry is Allergen => KNOWN_ALLERGENS.includes(entry as Allergen));
  return allergens.length ? [...new Set(allergens)] : undefined;
}

function parseIngredients(value: unknown): string[] | undefined {
  const source = text(value);
  if (!source) return undefined;
  const ingredients = source
    .split(/[,;]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 100);
  return ingredients.length ? ingredients : undefined;
}

function servingFacts(product: Record<string, unknown>, nutriments: Record<string, unknown>) {
  const servingSize = text(product.serving_size);
  const servingQuantity = nonNegativeNumber(product.serving_quantity);
  const hasActualServing = Boolean(servingSize) || servingQuantity > 0;
  const servingCalories = typeof nutriments['energy-kcal_serving'] === 'number'
    ? nutriments['energy-kcal_serving']
    : Number(nutriments['energy-kcal_serving']);

  if (hasActualServing && Number.isFinite(servingCalories) && servingCalories >= 0) {
    const label = servingSize ? `1 serving (${servingSize})` : '1 serving';
    return {
      servingSize,
      servingQuantity: servingQuantity || undefined,
      nutrition: {
        basis: 'serving' as const,
        label,
        calories: servingCalories,
        proteinGrams: nonNegativeNumber(nutriments.proteins_serving),
        carbGrams: nonNegativeNumber(nutriments.carbohydrates_serving),
        fatGrams: nonNegativeNumber(nutriments.fat_serving),
      },
    };
  }

  return {
    servingSize,
    servingQuantity: servingQuantity || undefined,
    nutrition: {
      basis: '100g' as const,
      label: '100 g',
      calories: nonNegativeNumber(nutriments['energy-kcal_100g'] ?? nutriments['energy-kcal']),
      proteinGrams: nonNegativeNumber(nutriments.proteins_100g),
      carbGrams: nonNegativeNumber(nutriments.carbohydrates_100g),
      fatGrams: nonNegativeNumber(nutriments.fat_100g),
    },
  };
}

/** A barcode is accepted only in standard numeric UPC/EAN lengths before a provider request. */
export function isValidBarcode(value: unknown): value is string {
  return typeof value === 'string' && BARCODE_PATTERN.test(value);
}

/**
 * Look up a product with a bounded request and an explicit result state.  `not_found`
 * means OFF answered without a product; `failed` means the provider could not be used.
 */
export async function lookupProductByBarcode(barcode: string): Promise<OpenFoodFactsLookupResult> {
  if (!isValidBarcode(barcode)) {
    return { status: 'failed', message: 'Enter an 8–14 digit UPC or EAN barcode.' };
  }

  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), OFF_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (response.status === 404) return { status: 'not_found' };
    if (!response.ok) return { status: 'failed', message: 'Open Food Facts could not complete the lookup. Please try again later.' };

    const data: unknown = await response.json();
    if (!data || typeof data !== 'object') {
      return { status: 'failed', message: 'Open Food Facts returned an unreadable response. Please try again.' };
    }
    const payload = data as { status?: number; product?: unknown };
    if (payload.status !== 1 || !payload.product || typeof payload.product !== 'object') return { status: 'not_found' };

    const product = payload.product as Record<string, unknown>;
    const nutriments = product.nutriments && typeof product.nutriments === 'object'
      ? product.nutriments as Record<string, unknown>
      : {};
    const facts = servingFacts(product, nutriments);
    const productName = text(product.product_name) ?? text(product.generic_name) ?? 'Unknown Product';

    return {
      status: 'found',
      product: {
        barcode,
        name: productName,
        caloriesPer100g: nonNegativeNumber(nutriments['energy-kcal_100g'] ?? nutriments['energy-kcal']),
        proteinGrams: nonNegativeNumber(nutriments.proteins_100g),
        carbGrams: nonNegativeNumber(nutriments.carbohydrates_100g),
        fatGrams: nonNegativeNumber(nutriments.fat_100g),
        imageUrl: sanitizeRemoteUrl(product.image_front_small_url ?? product.image_front_url ?? product.image_url),
        ingredients: parseIngredients(product.ingredients_text),
        allergens: parseAllergens(product.allergens_tags ?? product.allergens),
        ...facts,
      },
    };
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === 'AbortError';
    return {
      status: 'failed',
      message: timedOut
        ? 'Open Food Facts took too long to respond. Check your connection and try again.'
        : 'Open Food Facts is unavailable right now. Check your connection and try again.',
    };
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

/**
 * Legacy convenience API. Prefer `lookupProductByBarcode` when the UI needs to
 * distinguish an unknown UPC from a provider failure.
 */
export async function fetchProductByBarcode(barcode: string): Promise<OpenFoodFactsProduct | null> {
  const result = await lookupProductByBarcode(barcode);
  return result.status === 'found' ? result.product : null;
}
