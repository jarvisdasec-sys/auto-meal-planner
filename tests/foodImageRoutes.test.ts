import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveFoodImages: vi.fn(),
  getKrogerProductImage: vi.fn(),
  searchKrogerProductByUPC: vi.fn(),
}));

vi.mock('@/lib/foodImageResolver', () => ({ resolveFoodImages: mocks.resolveFoodImages }));
vi.mock('@/lib/krogerApi', () => ({
  getKrogerProductImage: mocks.getKrogerProductImage,
  searchKrogerProductByUPC: mocks.searchKrogerProductByUPC,
}));

import { POST as foodImagesPost } from '../app/api/food-images/route';
import { POST as krogerImagesPost } from '../app/api/kroger-images/route';

function request(path: string, body: string) {
  return new Request(`http://localhost${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
}

describe('food image API bounds and identity', () => {
  beforeEach(() => {
    mocks.resolveFoodImages.mockReset();
    mocks.getKrogerProductImage.mockReset();
    mocks.searchKrogerProductByUPC.mockReset();
  });

  it('returns a safe explicit response for malformed JSON and does no lookup', async () => {
    const response = await foodImagesPost(request('/api/food-images', '{not-json'));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: 'Invalid JSON body.', images: {} });
    expect(mocks.resolveFoodImages).not.toHaveBeenCalled();
  });

  it('rejects over-limit and duplicate batches before resolver work', async () => {
    const tooMany = Array.from({ length: 26 }, (_, index) => ({ id: `id-${index}`, name: 'Food' }));
    expect((await foodImagesPost(request('/api/food-images', JSON.stringify({ items: tooMany })))).status).toBe(413);

    const duplicate = [{ id: 'same', name: 'Food' }, { id: 'same', name: 'Other food' }];
    expect((await foodImagesPost(request('/api/food-images', JSON.stringify({ items: duplicate })))).status).toBe(400);
    expect(mocks.resolveFoodImages).not.toHaveBeenCalled();
  });

  it('preserves a catalog barcode as the resolver UPC payload', async () => {
    mocks.resolveFoodImages.mockResolvedValue({
      catalog: { id: 'catalog', url: '/images/foods/known.jpg', source: 'curated' },
    });

    const response = await foodImagesPost(
      request('/api/food-images', JSON.stringify({ items: [{ id: 'catalog', name: 'Known food', barcode: '0123456789012' }] })),
    );

    expect(response.status).toBe(200);
    expect(mocks.resolveFoodImages).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'catalog', upc: '0123456789012' }),
    ]);
  });

  it('does not use a name-only Kroger result to replace a source', async () => {
    const response = await krogerImagesPost(
      request('/api/kroger-images', JSON.stringify({ foods: [{ id: 'curated-food', name: 'Chicken breast' }] })),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ images: {} });
    expect(mocks.searchKrogerProductByUPC).not.toHaveBeenCalled();
    expect(mocks.getKrogerProductImage).not.toHaveBeenCalled();
  });

  it('uses only the exact barcode identity and rejects duplicate store batch IDs', async () => {
    mocks.searchKrogerProductByUPC.mockResolvedValue({
      productId: 'exact',
      upc: '0123456789012',
      name: 'Exact product',
      imageUrl: 'https://www.kroger.com/exact.jpg',
    });

    const response = await krogerImagesPost(
      request('/api/kroger-images', JSON.stringify({ foods: [{ id: 'exact', barcode: '0123456789012', name: 'Ignored name' }] })),
    );
    await expect(response.json()).resolves.toEqual({ images: { exact: 'https://www.kroger.com/exact.jpg' } });
    expect(mocks.searchKrogerProductByUPC).toHaveBeenCalledWith('0123456789012');

    const duplicate = await krogerImagesPost(
      request('/api/kroger-images', JSON.stringify({ foods: [{ id: 'same' }, { id: 'same' }] })),
    );
    expect(duplicate.status).toBe(400);
  });
});
