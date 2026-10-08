import type { FoodCategory } from './foodCatalog';
import type { PortionGuideKey } from './imageFallback';

/** Hand-measurement guides; mirrors PortionGuideKey so image fallbacks stay in sync. */
export type PortionHandGuide = PortionGuideKey;

export interface PortionGuide {
  guide: PortionHandGuide;
  label: string;
  /** Compact visual cue used beside the locally bundled hand illustration. */
  emoji: string;
  /** Approximate hand-measure reference, not a weighed serving. */
  measure: string;
  description: string;
  /** Tailwind text color class used for the guide accent. */
  colorClass: string;
}

/**
 * Hand-based portion guides. `FoodImage` pairs these keys with locally bundled,
 * explicitly illustrated hand-measure assets; the illustrations are not food photos.
 */
export const PORTION_GUIDES: Record<PortionHandGuide, PortionGuide> = {
  palm: {
    guide: 'palm',
    label: 'Palm',
    emoji: '🤚',
    measure: 'about 4–6 oz cooked',
    description: 'Approximate palm-sized hand guide for a protein portion.',
    colorClass: 'text-accent-green',
  },
  fist: {
    guide: 'fist',
    label: 'Fist',
    emoji: '✊',
    measure: 'about 1 cup',
    description: 'Approximate closed-fist hand guide for a vegetable portion.',
    colorClass: 'text-accent',
  },
  cupped_hand: {
    guide: 'cupped_hand',
    label: 'Cupped Hand',
    emoji: '🤲',
    measure: 'about 1/2–1 cup cooked',
    description: 'Approximate cupped-hand guide for a carbohydrate portion.',
    colorClass: 'text-accent-amber',
  },
  thumb: {
    guide: 'thumb',
    label: 'Thumb',
    emoji: '👍',
    measure: 'about 1 tbsp',
    description: 'Approximate entire-thumb hand guide for healthy fats such as avocado, nuts, and seeds.',
    colorClass: 'text-accent-red',
  },
  thumb_tip: {
    guide: 'thumb_tip',
    label: 'Thumb Tip',
    emoji: '☝️',
    measure: 'about 1 tsp',
    description: 'Approximate thumb-tip hand guide for concentrated fats such as butter, dressings, and cooking oil.',
    colorClass: 'text-accent-amber',
  },
};

// Maps each food category to its matching hand-portion guide
const CATEGORY_TO_GUIDE: Record<FoodCategory, PortionHandGuide> = {
  protein: 'palm',
  vegetable: 'fist',
  carb: 'cupped_hand',
  fat: 'thumb',
  snack: 'cupped_hand',
};

/**
 * A category alone cannot describe snack portions correctly. These deliberate
 * catalog-item overrides take precedence over the category fallback.
 */
export const PORTION_GUIDE_OVERRIDES: Readonly<Record<string, PortionHandGuide>> = {
  'greek-yogurt': 'palm',
  jerky: 'palm',
  'trail-mix': 'thumb',
  almonds: 'thumb',
  'peanut-butter': 'thumb',
  butter: 'thumb_tip',
  ghee: 'thumb_tip',
  'olive-oil': 'thumb_tip',
  'coconut-oil': 'thumb_tip',
  'avocado-oil': 'thumb_tip',
  dressing: 'thumb_tip',
};

export interface PortionGuideFood {
  id?: string;
  name?: string;
  category?: FoodCategory;
  /** Optional explicit guide for future custom/catalog records. */
  portionGuide?: PortionHandGuide;
}

function normalizedKey(value: string | undefined): string | undefined {
  const normalized = value
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return normalized || undefined;
}

/**
 * Resolve a food's deliberate primary guide before falling back to its broad
 * catalog category. Oil/butter names are supported for custom and legacy logs,
 * making the concentrated-fat thumb-tip guide reachable without mislabeling food
 * photography as an illustration.
 */
export function getPortionGuideForFood(food?: PortionGuideFood): PortionGuide | undefined {
  if (!food) return undefined;
  if (food.portionGuide && PORTION_GUIDES[food.portionGuide]) return PORTION_GUIDES[food.portionGuide];

  const id = normalizedKey(food.id);
  const name = normalizedKey(food.name);
  const override = (id && PORTION_GUIDE_OVERRIDES[id]) || (name && PORTION_GUIDE_OVERRIDES[name]);
  if (override) return PORTION_GUIDES[override];

  const isConcentratedFatName = /\b(?:oil|butter|ghee|dressing)\b/i.test(food.name ?? '');
  if (isConcentratedFatName) return PORTION_GUIDES.thumb_tip;
  const isNutName = /\b(?:nut|nuts|almond|almonds|cashew|cashews|walnut|walnuts|pecan|pecans|pistachio|pistachios)\b/i.test(food.name ?? '');
  if (isNutName) return PORTION_GUIDES.thumb;
  return food.category ? getPortionGuideForCategory(food.category) : undefined;
}

export function getPortionGuideForCategory(category: FoodCategory): PortionGuide {
  return PORTION_GUIDES[CATEGORY_TO_GUIDE[category]];
}

export const ALL_PORTION_GUIDES: PortionGuide[] = [
  PORTION_GUIDES.palm,
  PORTION_GUIDES.fist,
  PORTION_GUIDES.cupped_hand,
  PORTION_GUIDES.thumb,
  PORTION_GUIDES.thumb_tip,
];
