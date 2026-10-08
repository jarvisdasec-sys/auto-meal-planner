'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';

import {
  DEFAULT_FOOD_IMAGE,
  buildPortionAltText,
  getFallbackForPortionGuide,
  isFoodImageStandIn,
  type PortionGuideKey,
} from '@/lib/imageFallback';
import { sanitizeRemoteUrl } from '@/lib/imageHosts';
import { getCuratedFoodPhoto } from '@/lib/foodPhotos';
import {
  toFoodImageItem,
  type FoodImageItemInput,
  type ResolvedFoodImage,
} from '@/types/foodImage';

export { DEFAULT_FOOD_IMAGE as FALLBACK_FOOD_IMAGE };

interface FoodImageProps {
  /** A known authored food photo. Pipeline stand-ins do not count as authored. */
  src?: string;
  alt: string;
  portionGuide?: PortionGuideKey;
  /** Use `toFoodImageItem` at the data boundary so barcode is preserved as UPC. */
  item?: FoodImageItemInput;
  className?: string;
  sizes?: string;
  priority?: boolean;
}

type CandidateKind = 'photo' | 'curated' | 'guide' | 'placeholder';
type Candidate = { url: string; kind: CandidateKind };
type RenderState = { identity: string; resolved?: Candidate; failed: string[] };

function itemIdentity(item: ReturnType<typeof toFoodImageItem> | undefined, source: string | undefined, guide?: PortionGuideKey): string {
  return JSON.stringify({
    source: source ?? '',
    guide: guide ?? '',
    id: item?.id ?? '',
    name: item?.name ?? '',
    upc: item?.upc ?? '',
    store: item?.store ?? '',
    product: item?.storeProductId ?? '',
    direct: item?.storeImageUrl ?? '',
    query: item?.ingredientQuery ?? '',
  });
}

function candidateAltText(candidate: Candidate, name: string, guide?: PortionGuideKey): string {
  if (candidate.kind === 'curated') return `Illustrative food image of ${name}; not an exact serving`;
  if (candidate.kind === 'photo') return `Photo of ${name}`;
  if (candidate.kind === 'guide') return buildPortionAltText(name, guide);
  return `Generic food-image placeholder; no verified photo is available for ${name}.`;
}

/**
 * Image component with an honest candidate chain:
 * verified/authored photo → resolved exact photo → portion illustration → generic
 * placeholder → accessible neutral tile. Each candidate can fail once only.
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
  const serializedItem = JSON.stringify(toFoodImageItem(item ?? {}) ?? null);
  const canonicalItem = useMemo(
    () => serializedItem === 'null' ? undefined : JSON.parse(serializedItem) as NonNullable<ReturnType<typeof toFoodImageItem>>,
    [serializedItem],
  );
  const effectiveGuide = portionGuide ?? canonicalItem?.portionGuide;
  const validSource = sanitizeRemoteUrl(src);
  // Refresh only reserved seed IDs. A custom food with the same name keeps its
  // authored/UPC photo; old built-in log snapshots cannot retain a wrong stock image.
  const curatedSeedSource = canonicalItem ? getCuratedFoodPhoto({ id: canonicalItem.id }) : undefined;
  const authoredSource = curatedSeedSource ?? (validSource && !isFoodImageStandIn(validSource) ? validSource : undefined);
  const identity = itemIdentity(canonicalItem, validSource, effectiveGuide);
  const [state, setState] = useState<RenderState>({ identity: '', failed: [] });

  const activeState = state.identity === identity ? state : { identity, failed: [] as string[] };

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8_000);
    let active = true;

    // State carries its identity so a new card never renders stale resolved/failed
    // values during React's effect transition.
    setState({ identity, failed: [] });
    if (!canonicalItem || authoredSource) {
      window.clearTimeout(timeout);
      return () => controller.abort();
    }

    void (async () => {
      try {
        const response = await fetch('/api/food-images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: [{ ...canonicalItem, portionGuide: effectiveGuide }],
          }),
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data = (await response.json()) as { images?: Record<string, ResolvedFoodImage> };
        const resolved = data.images?.[canonicalItem.id];
        const url = sanitizeRemoteUrl(resolved?.url);
        if (
          active &&
          url &&
          !isFoodImageStandIn(url) &&
          resolved?.source !== 'portion_guide' &&
          resolved?.source !== 'placeholder'
        ) {
          const candidate: Candidate = {
            url,
            kind: resolved?.source === 'curated' ? 'curated' : 'photo',
          };
          setState((current) =>
            current.identity === identity
              ? { ...current, resolved: candidate }
              : current,
          );
        }
      } catch {
        // Leave the immediate guide/placeholder candidate in place.
      } finally {
        window.clearTimeout(timeout);
      }
    })();

    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [identity, authoredSource, canonicalItem, effectiveGuide]);

  const candidates = useMemo(() => {
    const ordered: Candidate[] = [
      ...(authoredSource ? [{ url: authoredSource, kind: curatedSeedSource ? 'curated' as const : 'photo' as const }] : []),
      ...(activeState.resolved ? [activeState.resolved] : []),
      ...(getFallbackForPortionGuide(effectiveGuide)
        ? [{ url: getFallbackForPortionGuide(effectiveGuide) as string, kind: 'guide' as const }]
        : []),
      { url: DEFAULT_FOOD_IMAGE, kind: 'placeholder' },
    ];
    const seen = new Set<string>();
    return ordered.filter((candidate) => !seen.has(candidate.url) && Boolean(seen.add(candidate.url)));
  }, [activeState.resolved, authoredSource, curatedSeedSource, effectiveGuide]);

  const current = candidates.find((candidate) => !activeState.failed.includes(candidate.url));
  const wrapperClass = `relative w-full h-48 overflow-hidden rounded-t-xl bg-surface-border/30 ${className}`;

  if (!current) {
    return (
      <div className={wrapperClass} role="img" aria-label={`Image unavailable for ${alt}`}>
        <span className="absolute inset-0 flex items-center justify-center px-3 text-center text-xs font-medium text-gray-500">
          Image unavailable for {alt}
        </span>
      </div>
    );
  }

  return (
    <div className={wrapperClass}>
      <Image
        key={`${identity}:${current.url}`}
        src={current.url}
        alt={candidateAltText(current, alt, effectiveGuide)}
        fill
        sizes={sizes}
        priority={priority}
        onError={() =>
          setState((previous) =>
            previous.identity !== identity || previous.failed.includes(current.url)
              ? previous
              : { ...previous, failed: [...previous.failed, current.url] },
          )
        }
        className="object-contain p-2"
      />
    </div>
  );
}
