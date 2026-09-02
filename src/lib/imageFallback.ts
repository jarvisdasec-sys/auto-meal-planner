/**
 * Portion-guide-aware image fallbacks (tier 4) and the local default (tier 5).
 *
 * Previously every food fell back to one generic plate photo, which meant a broken
 * protein image could render an unrelated carb dish. Each hand-portion guide now has
 * its own category-accurate fallback so a failed image degrades to the RIGHT macro.
 *
 * All assets below live under /public, so tiers 4 and 5 work with no network access.
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

/** Tier 5: last-resort image, used when an item has no portion guide at all. */
export const DEFAULT_FOOD_IMAGE = '/images/placeholders/food-default.png';

/** Explicit per-guide fallback map — deliberately NOT collapsed to a single placeholder. */
export const PORTION_GUIDE_FALLBACKS: Record<PortionGuideKey, string> = {
  palm: FALLBACK_PALM_PROTEIN,
  fist: FALLBACK_FIST_VEGGIES,
  cupped_hand: FALLBACK_CUPPED_CARBS,
  thumb: FALLBACK_THUMB_FATS,
  thumb_tip: FALLBACK_THUMB_TIP_CONCENTRATED_FATS,
};

/** Human-readable alt text per guide, used for accessible image descriptions. */
export const PORTION_GUIDE_ALT_TEXT: Record<PortionGuideKey, string> = {
  palm: 'Palm of hand protein portion guide',
  fist: 'Closed fist vegetable portion guide',
  cupped_hand: 'Cupped hand carbohydrate portion guide',
  thumb: 'Entire thumb healthy fats portion guide',
  thumb_tip: 'Thumb tip concentrated fats portion guide',
};

/** Resolve the category-accurate tier 4 fallback, or undefined when there is no guide. */
export function getFallbackForPortionGuide(guide?: PortionGuideKey): string | undefined {
  return guide ? PORTION_GUIDE_FALLBACKS[guide] : undefined;
}

/** Build descriptive alt text combining the food name and its portion guide. */
export function buildPortionAltText(name: string, guide?: PortionGuideKey): string {
  return guide ? `${name} — ${PORTION_GUIDE_ALT_TEXT[guide]}` : name;
}
