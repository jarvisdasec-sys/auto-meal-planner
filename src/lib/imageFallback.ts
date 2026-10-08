/**
 * Portion-guide-aware image fallbacks (tier 4) and the local default (tier 5).
 * These assets are intentionally illustrations/stand-ins, never evidence that a
 * card has a verified photograph of the named food.
 */

/** The five hand-measurement portion guides. */
export type PortionGuideKey = 'palm' | 'fist' | 'cupped_hand' | 'thumb' | 'thumb_tip';

// Palm of hand = Protein (chicken, beef, fish, tofu)
export const FALLBACK_PALM_PROTEIN = '/images/portion-guides/palm.png';
// Closed fist = Vegetables (broccoli, spinach, greens)
export const FALLBACK_FIST_VEGGIES = '/images/portion-guides/fist.png';
// Cupped hand = Carbohydrates (rice, oats, potatoes, fruit)
export const FALLBACK_CUPPED_CARBS = '/images/portion-guides/cupped-hand.png';
// Entire thumb = Healthy fats (avocado, nuts, seeds, oils)
export const FALLBACK_THUMB_FATS = '/images/portion-guides/thumb.png';
// Thumb tip = Concentrated fats (butter, dressings, cooking oils)
export const FALLBACK_THUMB_TIP_CONCENTRATED_FATS = '/images/portion-guides/thumb-tip.png';

/** Tier 5: last-resort image shipped with the app. */
export const DEFAULT_FOOD_IMAGE = '/images/placeholders/food-default.png';

/** Explicit per-guide fallback map — deliberately not collapsed to one placeholder. */
export const PORTION_GUIDE_FALLBACKS: Record<PortionGuideKey, string> = {
  palm: FALLBACK_PALM_PROTEIN,
  fist: FALLBACK_FIST_VEGGIES,
  cupped_hand: FALLBACK_CUPPED_CARBS,
  thumb: FALLBACK_THUMB_FATS,
  thumb_tip: FALLBACK_THUMB_TIP_CONCENTRATED_FATS,
};

/** Human-readable description per guide; explicitly identifies an illustration. */
export const PORTION_GUIDE_ALT_TEXT: Record<PortionGuideKey, string> = {
  palm: 'Illustrated palm-of-hand protein portion guide',
  fist: 'Illustrated closed-fist vegetable portion guide',
  cupped_hand: 'Illustrated cupped-hand carbohydrate portion guide',
  thumb: 'Illustrated entire-thumb healthy-fat portion guide',
  thumb_tip: 'Illustrated thumb-tip concentrated-fat portion guide',
};

const STAND_IN_PATHS = new Set<string>([DEFAULT_FOOD_IMAGE, ...Object.values(PORTION_GUIDE_FALLBACKS)]);

/** Whether a local URL is one of this pipeline's fallback illustrations/placeholders. */
export function isFoodImageStandIn(url: unknown): boolean {
  if (typeof url !== 'string') return false;
  const path = url.split(/[?#]/, 1)[0];
  return STAND_IN_PATHS.has(path);
}

/** Resolve the category-accurate tier 4 fallback, or undefined when there is no guide. */
export function getFallbackForPortionGuide(guide?: PortionGuideKey): string | undefined {
  return guide ? PORTION_GUIDE_FALLBACKS[guide] : undefined;
}

/** Accurate accessible text for a guide, without claiming it is food photography. */
export function buildPortionAltText(name: string, guide?: PortionGuideKey): string {
  return guide
    ? `${PORTION_GUIDE_ALT_TEXT[guide]}; shown because a food photo for ${name} is unavailable.`
    : `Generic food-image placeholder; no photo is available for ${name}.`;
}
