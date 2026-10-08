import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/foodPhotos', () => ({ getCuratedFoodPhoto: vi.fn() }));
vi.mock('@/lib/krogerApi', () => ({
  getKrogerProductImage: vi.fn(),
  searchKrogerProductByUPC: vi.fn(),
}));

import { getCuratedFoodPhoto } from '@/lib/foodPhotos';
import { clearFoodImageCacheForTests, foodImageCacheKey, resolveFoodImage } from '@/lib/foodImageResolver';
import { getKrogerProductImage, searchKrogerProductByUPC } from '@/lib/krogerApi';

const curated = vi.mocked(getCuratedFoodPhoto);
const productImage = vi.mocked(getKrogerProductImage);
const productByUpc = vi.mocked(searchKrogerProductByUPC);

describe('resolveFoodImage', () => {
  beforeEach(() => {
    clearFoodImageCacheForTests();
    curated.mockReset();
    productImage.mockReset();
    productByUpc.mockReset();
    curated.mockReturnValue(undefined);
    productImage.mockResolvedValue(null);
    productByUpc.mockResolvedValue(null);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 0 }) }));
  });

  afterEach(() => vi.unstubAllGlobals());

  it('uses a curated generic photo without network requests when no exact product identity exists', async () => {
    curated.mockReturnValue('/images/foods/chicken-breast.jpg');

    await expect(
      resolveFoodImage({
        id: 'chicken',
        name: 'Chicken breast',
        store: 'kroger',
      }),
    ).resolves.toEqual({ id: 'chicken', url: '/images/foods/chicken-breast.jpg', source: 'curated' });

    expect(productImage).not.toHaveBeenCalled();
    expect(productByUpc).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('uses exact product ID before UPC and never falls through when its image is valid', async () => {
    productImage.mockResolvedValue('https://www.kroger.com/product-id.jpg');
    curated.mockReturnValue('/images/foods/generic.jpg');

    const result = await resolveFoodImage({
      id: 'exact-product',
      name: 'Exact product',
      store: 'kroger',
      storeProductId: 'product-id',
      upc: '0123456789012',
    });

    expect(result).toMatchObject({ source: 'store', url: 'https://www.kroger.com/product-id.jpg' });
    expect(productImage).toHaveBeenCalledWith('product-id');
    expect(productByUpc).not.toHaveBeenCalled();
    expect(curated).not.toHaveBeenCalled();
  });

  it('uses an exact UPC photo before a generic-name curated illustration', async () => {
    curated.mockReturnValue('/images/foods/generic.jpg');
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ status: 1, product: { code: '0123456789012', image_url: 'https://images.openfoodfacts.org/exact.jpg' } }),
    } as Response);
    await expect(resolveFoodImage({ id: 'upc', name: 'Exact product', upc: '0123456789012' }))
      .resolves.toMatchObject({ source: 'open_food_facts', url: 'https://images.openfoodfacts.org/exact.jpg' });
    expect(curated).not.toHaveBeenCalled();
  });

  it('rejects an adapter UPC mismatch instead of returning an unrelated retailer image', async () => {
    productByUpc.mockResolvedValue({
      productId: 'wrong',
      upc: '9999999999999',
      name: 'Unrelated product',
      imageUrl: 'https://www.kroger.com/wrong.jpg',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 1, product: { code: '9999999999999', image_url: 'https://images.openfoodfacts.org/wrong.jpg' } }),
      }),
    );

    const result = await resolveFoodImage({
      id: 'upc-item',
      name: 'Requested product',
      store: 'kroger',
      upc: '0123456789012',
      portionGuide: 'palm',
    });

    expect(result).toEqual({ id: 'upc-item', url: '/images/portion-guides/palm.png', source: 'portion_guide' });
    vi.unstubAllGlobals();
  });

  it('isolates cache keys and results for same-name direct URLs and product IDs', async () => {
    const first = {
      id: 'same-name-a',
      name: 'Protein shake',
      store: 'kroger' as const,
      storeProductId: 'product-a',
      storeImageUrl: 'https://www.kroger.com/a.jpg',
      ingredientQuery: 'protein shake',
      portionGuide: 'palm' as const,
    };
    const second = { ...first, id: 'same-name-b', storeProductId: 'product-b', storeImageUrl: 'https://www.kroger.com/b.jpg' };

    expect(foodImageCacheKey(first)).not.toBe(foodImageCacheKey(second));
    await expect(resolveFoodImage(first)).resolves.toMatchObject({ url: 'https://www.kroger.com/a.jpg' });
    await expect(resolveFoodImage(second)).resolves.toMatchObject({ url: 'https://www.kroger.com/b.jpg' });
  });
});
