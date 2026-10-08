import { describe, expect, it } from 'vitest';

import { sanitizeRemoteUrl } from '@/lib/imageHosts';

describe('sanitizeRemoteUrl', () => {
  it('accepts a single-slash local public asset', () => {
    expect(sanitizeRemoteUrl('/images/placeholders/food-default.png')).toBe('/images/placeholders/food-default.png');
  });

  it('rejects protocol-relative, credentialed, insecure, backslash, and non-allowlisted values', () => {
    expect(sanitizeRemoteUrl('//example.test/food.jpg')).toBeUndefined();
    expect(sanitizeRemoteUrl('https://user:pass@images.unsplash.com/food.jpg')).toBeUndefined();
    expect(sanitizeRemoteUrl('http://images.unsplash.com/food.jpg')).toBeUndefined();
    expect(sanitizeRemoteUrl('https://example.test/food.jpg')).toBeUndefined();
    expect(sanitizeRemoteUrl('/images\\food.jpg')).toBeUndefined();
    expect(sanitizeRemoteUrl('/images%5Cfood.jpg')).toBeUndefined();
  });

  it('accepts only configured HTTPS remote image hosts', () => {
    expect(sanitizeRemoteUrl('https://images.openfoodfacts.org/images/products/1.jpg')).toBe(
      'https://images.openfoodfacts.org/images/products/1.jpg',
    );
  });
});
