// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/image', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  return {
    default: ({ fill: _fill, priority: _priority, ...props }: Record<string, unknown>) =>
      React.createElement('img', props),
  };
});

import FoodImage from '@/components/FoodImage';
import { DEFAULT_FOOD_IMAGE } from '@/lib/imageFallback';

function apiResult(id: string, url: string, source: 'curated' | 'store' = 'store') {
  return { ok: true, json: async () => ({ images: { [id]: { id, url, source } } }) } as Response;
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('FoodImage', () => {
  let container: HTMLDivElement;
  let root: Root;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('resolves a default stand-in and preserves its catalog barcode as UPC', async () => {
    fetchMock.mockResolvedValue(apiResult('catalog', '/images/foods/known.jpg', 'curated'));
    await act(async () => {
      root.render(
        createElement(FoodImage, {
          src: DEFAULT_FOOD_IMAGE,
          alt: 'Known food',
          portionGuide: 'palm',
          item: { id: 'catalog', name: 'Known food', barcode: '0123456789012' },
        }),
      );
    });
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(payload.items[0]).toMatchObject({ id: 'catalog', upc: '0123456789012' });
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/images/foods/known.jpg');
    expect(container.querySelector('img')?.getAttribute('alt')).toBe('Illustrative food image of Known food; not an exact serving');
  });

  it('refreshes an old built-in photo snapshot locally without changing custom authored photos', async () => {
    await act(async () => root.render(createElement(FoodImage, {
      src: 'https://images.unsplash.com/photo-old-wrong-image',
      alt: 'Grilled Chicken Breast',
      item: { id: 'grilled-chicken', name: 'Grilled Chicken Breast' },
    })));
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/images/foods/chicken-breast.webp');
    expect(container.querySelector('img')?.getAttribute('alt')).toContain('Illustrative food image');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('allows an invalid truthy source to resolve but never looks up a valid authored image', async () => {
    fetchMock.mockResolvedValue(apiResult('invalid', '/images/foods/resolved.jpg'));
    await act(async () => {
      root.render(
        createElement(FoodImage, {
          src: '//example.test/wrong.jpg',
          alt: 'Invalid source',
          item: { id: 'invalid', name: 'Invalid source' },
        }),
      );
    });
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/images/foods/resolved.jpg');

    await act(async () => {
      root.render(
        createElement(FoodImage, {
          src: 'https://images.unsplash.com/photo-123',
          alt: 'Authored food',
          item: { id: 'authored', name: 'Authored food', upc: '0123456789012' },
        }),
      );
    });
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('https://images.unsplash.com/photo-123');
  });

  it('ignores a late result from a previous item identity', async () => {
    let resolveFirst!: (value: Response) => void;
    fetchMock
      .mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValueOnce(apiResult('second', '/images/foods/second.jpg'));

    await act(async () => {
      root.render(createElement(FoodImage, { src: DEFAULT_FOOD_IMAGE, alt: 'First', item: { id: 'first', name: 'First' } }));
    });
    await flush();
    await act(async () => {
      root.render(createElement(FoodImage, { src: DEFAULT_FOOD_IMAGE, alt: 'Second', item: { id: 'second', name: 'Second' } }));
    });
    await flush();
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/images/foods/second.jpg');

    await act(async () => resolveFirst(apiResult('first', '/images/foods/first.jpg')));
    await flush();
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/images/foods/second.jpg');
  });

  it('tries each fallback once then exposes an accessible neutral tile without a retry loop', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ images: {} }) } as Response);
    await act(async () => {
      root.render(
        createElement(FoodImage, {
          alt: 'No image food',
          portionGuide: 'palm',
          item: { id: 'none', name: 'No image food' },
        }),
      );
    });
    await flush();

    await act(async () => container.querySelector('img')?.dispatchEvent(new Event('error', { bubbles: true })));
    await flush();
    expect(container.querySelector('img')?.getAttribute('src')).toBe(DEFAULT_FOOD_IMAGE);

    await act(async () => container.querySelector('img')?.dispatchEvent(new Event('error', { bubbles: true })));
    await flush();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('Image unavailable for No image food');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
