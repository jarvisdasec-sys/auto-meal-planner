/**
 * Hosts we are willing to render through `next/image`.
 * Keep this list exactly synchronized with `images.remotePatterns` in next.config.js.
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

const SINGLE_SLASH_LOCAL_PATH = /^\/(?!\/)/;

/**
 * Return a render-safe URL or `undefined`.
 *
 * Local URLs must begin with one slash (for example `/images/food/chicken.jpg`).
 * Protocol-relative URLs, backslashes, credentials, non-HTTPS URLs, non-default
 * ports, and hosts outside the Next Image allow-list are all rejected. The same
 * function is used at the API boundary and in the client component so an invalid
 * saved custom URL cannot suppress a legitimate lookup.
 */
export function sanitizeRemoteUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0 || value !== value.trim()) return undefined;
  if (/[^\u0020-\u007e]/.test(value) || value.includes('\\')) return undefined;

  if (SINGLE_SLASH_LOCAL_PATH.test(value)) {
    // Percent-encoded backslashes are interpreted as path separators by some URL
    // consumers, so reject them as well rather than normalizing an ambiguous path.
    try {
      if (decodeURIComponent(value).includes('\\')) return undefined;
    } catch {
      return undefined;
    }
    return value;
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return undefined;
  }

  if (
    parsed.protocol !== 'https:' ||
    parsed.username ||
    parsed.password ||
    parsed.port ||
    !ALLOWED_IMAGE_HOSTS.has(parsed.hostname.toLowerCase())
  ) {
    return undefined;
  }

  return parsed.toString();
}
