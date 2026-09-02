'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';

import {
  DEFAULT_FOOD_IMAGE,
  buildPortionAltText,
  getFallbackForPortionGuide,
  type PortionGuideKey,
} from '@/lib/imageFallback';
import { sanitizeRemoteUrl } from '@/lib/imageHosts';
import { LOCAL_PLACEHOLDER_IMAGE, type FoodItem, type ResolvedFoodImage } from '@/types/foodImage';

// Re-exported for any component that wants the generic fallback constant directly
export { DEFAULT_FOOD_IMAGE as FALLBACK_FOOD_IMAGE };

interface FoodImageProps {
  /** Already-known image (tier 1 when it is a retailer CDN URL). */
  src?: string;
  /** Food name; combined with portionGuide to build descriptive alt text. */
  alt: string;
  /** Drives the tier 4 fallback image and the accessible portion description. */
  portionGuide?: PortionGuideKey;
  /** Enables the `/api/food-images` lookup for tiers 1-3. */
  item?: Pick<FoodItem, 'id' | 'name' | 'store' | 'storeProductId' | 'storeImageUrl' | 'upc' | 'ingredientQuery'>;
  className?: string;
  sizes?: string;
  priority?: boolean;
}

/**
 * Food/supplement card image with a five-tier source chain:
 *
 *   1. store CDN (Walmart / Kroger)
 *   2. Open Food Facts UPC match        resolved server-side via /api/food-images
 *   3. Spoonacular / Unsplash search
 *   4. portion-guide graphic for the item's macro category
 *   5. local static placeholder
 *
 * Tiers 4 and 5 render immediately so the card is never empty, and the remote result
 * swaps in once available. Each URL may fail exactly once, so a broken image can
 * never retry-loop; if every tier fails, a labelled tile renders instead.
 */
export default function FoodImage({
  src,
  alt,
  portionGuide,
  item,
  className = '',
  sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
  priority = false,
}: FoodImageProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string>();
  const [failed, setFailed] = useState<string[]>([]);

  const candidates = useMemo(() => {
    const ordered = [
      sanitizeRemoteUrl(src),
      resolvedUrl,
      getFallbackForPortionGuide(portionGuide),
      LOCAL_PLACEHOLDER_IMAGE,
    ].filter((url): url is string => Boolean(url));

    return Array.from(new Set(ordered));
  }, [src, resolvedUrl, portionGuide]);

  const itemId = item?.id;

  useEffect(() => {
    if (!item || src) return;

    const controller = new AbortController();

    (async () => {
      try {
        const response = await fetch('/api/food-images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: [{ ...item, portionGuide }] }),
          signal: controller.signal,
        });
        if (!response.ok) return;

        const data = (await response.json()) as { images?: Record<string, ResolvedFoodImage> };
        const resolved = data.images?.[item.id];
        // Ignore server-side stand-ins; tiers 4 and 5 below already cover those.
        if (resolved && resolved.source !== 'placeholder' && resolved.source !== 'portion_guide') {
          setResolvedUrl(sanitizeRemoteUrl(resolved.url));
        }
      } catch {
        // Leave the current tier on screen.
      }
    })();

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId, src, portionGuide]);

  const current = candidates.find((url) => !failed.includes(url));
  const description = buildPortionAltText(alt, portionGuide);
  const wrapperClass = `relative w-full h-48 overflow-hidden rounded-t-xl bg-surface-border/30 ${className}`;

  if (!current) {
    return (
      <div className={wrapperClass} role="img" aria-label={description}>
        <span className="absolute inset-0 flex items-center justify-center px-3 text-center text-xs font-medium text-gray-500">
          {alt}
        </span>
      </div>
    );
  }

  return (
    <div className={wrapperClass}>
      <Image
        key={current}
        src={current}
        alt={description}
        fill
        sizes={sizes}
        priority={priority}
        onError={() => setFailed((previous) => (previous.includes(current) ? previous : [...previous, current]))}
        className="object-cover"
      />
    </div>
  );
}
