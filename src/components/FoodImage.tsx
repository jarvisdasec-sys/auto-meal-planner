'use client';

import { DEFAULT_FOOD_IMAGE } from '@/lib/imageFallback';

// Re-exported for any component that wants the same fallback constant directly
export { DEFAULT_FOOD_IMAGE as FALLBACK_FOOD_IMAGE };

interface FoodImageProps {
  src?: string;
  alt: string;
  className?: string;
}

/** Shared food/supplement card image with a guaranteed non-broken fallback. */
export default function FoodImage({ src, alt, className = '' }: FoodImageProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src || DEFAULT_FOOD_IMAGE}
      alt={alt}
      onError={(e) => {
        e.currentTarget.src = DEFAULT_FOOD_IMAGE;
      }}
      className={`object-cover w-full h-48 rounded-t-xl ${className}`}
    />
  );
}
