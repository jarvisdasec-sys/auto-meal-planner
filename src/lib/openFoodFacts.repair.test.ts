import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchProductByBarcode, isValidBarcode, lookupProductByBarcode } from './openFoodFacts';

afterEach(() => vi.unstubAllGlobals());

describe('Open Food Facts repair adapter', () => {
  it('uses per-serving nutrition only with a supplied actual serving and retains a safe exact image', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      status: 1,
      product: {
        product_name: 'Fixture cereal', serving_size: '30 g', serving_quantity: 30,
        image_front_small_url: 'https://images.openfoodfacts.org/images/products/123.jpg',
        allergens_tags: ['en:milk'], ingredients_text: 'oats, milk',
        nutriments: { 'energy-kcal_100g': 400, proteins_100g: 10, carbohydrates_100g: 70, fat_100g: 8, 'energy-kcal_serving': 120, proteins_serving: 3, carbohydrates_serving: 21, fat_serving: 2 },
      },
    }), { status: 200 })));
    const result = await lookupProductByBarcode('12345678');
    expect(result).toEqual(expect.objectContaining({ status: 'found' }));
    if (result.status !== 'found') throw new Error('expected fixture result');
    expect(result.product.nutrition).toEqual({ basis: 'serving', label: '1 serving (30 g)', calories: 120, proteinGrams: 3, carbGrams: 21, fatGrams: 2 });
    expect(result.product.imageUrl).toBe('https://images.openfoodfacts.org/images/products/123.jpg');
    expect(result.product.allergens).toEqual(['milk']);
    expect(result.product.ingredients).toEqual(['oats', 'milk']);
  });

  it('labels fallback nutrition as 100 g instead of inventing a serving and distinguishes invalid/not-found/failed states', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 1, product: { product_name: 'Fixture', nutriments: { 'energy-kcal_100g': 55, proteins_100g: 4, carbohydrates_100g: 7, fat_100g: 1 } } }), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    const result = await lookupProductByBarcode('12345678');
    expect(result).toMatchObject({ status: 'found', product: { nutrition: { basis: '100g', label: '100 g', calories: 55 } } });
    expect(isValidBarcode('abc')).toBe(false);
    expect(await lookupProductByBarcode('abc')).toEqual(expect.objectContaining({ status: 'failed' }));
    expect(fetch).toHaveBeenCalledTimes(1);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })));
    expect(await lookupProductByBarcode('12345678')).toEqual({ status: 'not_found' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await fetchProductByBarcode('12345678')).toBeNull();
  });
});
