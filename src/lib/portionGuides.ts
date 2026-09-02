import type { FoodCategory } from './foodCatalog';
import type { PortionGuideKey } from './imageFallback';

/** Hand-measurement guides; mirrors PortionGuideKey so image fallbacks stay in sync. */
export type PortionHandGuide = PortionGuideKey;

export interface PortionGuide {
  guide: PortionHandGuide;
  label: string;
  /** Emoji rendered alongside the SVG illustration */
  emoji: string;
  description: string;
  /** Tailwind text color class used for the illustration accent */
  colorClass: string;
}

// Hand-based portion guides. Illustrations are inline SVG (see PortionGuideCard),
// so there are no external image URLs that can break or mismatch.
export const PORTION_GUIDES: Record<PortionHandGuide, PortionGuide> = {
  palm: {
    guide: 'palm',
    label: 'Palm',
    emoji: '🤚',
    description: 'One palm-sized portion of protein (about 4–6 oz cooked).',
    colorClass: 'text-accent-green',
  },
  fist: {
    guide: 'fist',
    label: 'Fist',
    emoji: '✊',
    description: 'One fist-sized portion of vegetables (about 1 cup).',
    colorClass: 'text-accent',
  },
  cupped_hand: {
    guide: 'cupped_hand',
    label: 'Cupped Hand',
    emoji: '🤲',
    description: 'One cupped handful of carbohydrates (about 1/2–1 cup cooked).',
    colorClass: 'text-accent-amber',
  },
  thumb: {
    guide: 'thumb',
    label: 'Thumb',
    emoji: '👍',
    description: 'One entire-thumb portion of healthy fats — avocado, nuts, seeds, oils (about 1 tbsp).',
    colorClass: 'text-accent-red',
  },
  thumb_tip: {
    guide: 'thumb_tip',
    label: 'Thumb Tip',
    emoji: '☝️',
    description: 'One thumb-tip portion of concentrated fats — butter, dressings, cooking oil (about 1 tsp).',
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
