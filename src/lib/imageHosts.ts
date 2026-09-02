/**
 * Hosts we are willing to render through `next/image`.
 * Must stay in sync with `images.remotePatterns` in next.config.js.
 */
export const ALLOWED_IMAGE_HOSTS = new Set([
  'i5.walmartimages.com',
  'i5.walmartimages.ca',
  'www.kroger.com',
  'kroger.com',
  'images.openfoodfacts.org',
  'static.openfoodfacts.org',
  'img.spoonacular.com',
  'spoonacular.com',
  'images.unsplash.com',
]);

/**
 * Return the URL only if it is https on an allow-listed host, else undefined.
 * Guards against SSRF on the server and against `next/image` 400s on the client
 * when a user-supplied custom food carries an arbitrary URL.
 */
export function sanitizeRemoteUrl(url: unknown): string | undefined {
  if (typeof url !== 'string' || url.length === 0) return undefined;

  // Local assets under /public are always safe.
  if (url.startsWith('/')) return url;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }
  if (parsed.protocol !== 'https:') return undefined;
  if (!ALLOWED_IMAGE_HOSTS.has(parsed.hostname)) return undefined;
  return parsed.toString();
}
