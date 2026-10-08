/**
 * Master Nutrition & Supplement Database — Type Definitions
 * Shared types for the food/supplement catalog, serving-size conversions,
 * and micronutrient/supplement-specific fields used across the app.
 */

import type { PortionGuideKey } from '@/lib/imageFallback';
import type { Allergen, DietaryTags } from '@/lib/fitnessMealPlanner';

// ============================================================
// 35 MASTER FOOD CATEGORIES + SUPPLEMENTS
// ============================================================

export type FoodMasterCategory =
  | 'red_meat'
  | 'poultry'
  | 'fish'
  | 'shellfish'
  | 'eggs'
  | 'dairy_milk'
  | 'cheese'
  | 'yogurt'
  | 'grains'
  | 'bread_bakery'
  | 'pasta'
  | 'rice'
  | 'cereal'
  | 'legumes'
  | 'nuts'
  | 'seeds'
  | 'vegetables'
  | 'leafy_greens'
  | 'cruciferous_vegetables'
  | 'root_vegetables'
  | 'fruits'
  | 'berries'
  | 'citrus_fruits'
  | 'tropical_fruits'
  | 'fats_oils'
  | 'condiments'
  | 'sauces_dressings'
  | 'spices_herbs'
  | 'beverages'
  | 'alcohol'
  | 'snacks'
  | 'sweets_desserts'
  | 'baked_goods'
  | 'fast_food'
  | 'soups_stews';

/** All 35 master food categories, in display order. */
export const FOOD_MASTER_CATEGORIES: FoodMasterCategory[] = [
  'red_meat',
  'poultry',
  'fish',
  'shellfish',
  'eggs',
  'dairy_milk',
  'cheese',
  'yogurt',
  'grains',
  'bread_bakery',
  'pasta',
  'rice',
  'cereal',
  'legumes',
  'nuts',
  'seeds',
  'vegetables',
  'leafy_greens',
  'cruciferous_vegetables',
  'root_vegetables',
  'fruits',
  'berries',
  'citrus_fruits',
  'tropical_fruits',
  'fats_oils',
  'condiments',
  'sauces_dressings',
  'spices_herbs',
  'beverages',
  'alcohol',
  'snacks',
  'sweets_desserts',
  'baked_goods',
  'fast_food',
  'soups_stews',
];

/** The full category union: any of the 35 master food categories, or a supplement. */
export type NutritionCategory = FoodMasterCategory | 'supplement';

export const ALL_NUTRITION_CATEGORIES: NutritionCategory[] = [...FOOD_MASTER_CATEGORIES, 'supplement'];

// ============================================================
// SERVING UNIT CONVERSIONS
// ============================================================

export type ServingUnit = 'g' | 'oz' | 'cup' | 'scoop' | 'slice' | 'tbsp' | 'tsp' | 'piece' | 'ml' | 'serving';

export interface ServingSize {
  amount: number;
  unit: ServingUnit;
}

// Approximate grams-per-unit used to convert between serving units for comparison purposes
export const SERVING_UNIT_TO_GRAMS: Record<ServingUnit, number> = {
  g: 1,
  oz: 28.35,
  cup: 240,
  scoop: 30,
  slice: 28,
  tbsp: 15,
  tsp: 5,
  piece: 50,
  ml: 1,
  serving: 100,
};

export function convertServingToGrams(serving: ServingSize): number {
  return serving.amount * SERVING_UNIT_TO_GRAMS[serving.unit];
}

// ============================================================
// SUPPLEMENT-SPECIFIC FIELDS
// ============================================================

export type SupplementTiming = 'pre_workout' | 'post_workout' | 'morning' | 'evening' | 'with_meal' | 'anytime';

export interface SupplementDetails {
  caffeineMg?: number;
  creatineGrams?: number;
  activeIngredients?: string[];
  timing?: SupplementTiming;
}

// ============================================================
// MASTER NUTRITION ITEM
// ============================================================

export interface Micronutrients {
  fiberGrams?: number;
  sugarGrams?: number;
  sodiumMg?: number;
}

export interface NutritionItem extends Micronutrients, SupplementDetails {
  id: string;
  name: string;
  brand?: string;
  category: NutritionCategory;
  isSupplement: boolean;
  /** Hand-measurement portion guide this item is measured by (drives image fallback). */
  portionGuide?: PortionGuideKey;
  servingSize: ServingSize;
  calories: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
  /** Freeform dietary tags for search/filtering, e.g. "keto", "high_protein", "vegan" */
  dietaryTags: string[];
  /** Optional ingredient names supplied by a label or recipe; absent means dietary facts are unverified. */
  ingredients?: string[];
  /** Known major allergens. This is optional to keep existing database records valid. */
  allergens?: Allergen[];
  /** Optional singular/label-style allergen alias accepted by the dietary evaluator. */
  allergen?: Allergen | Allergen[];
  /** Optional structured dietary facts for the shared dietary evaluator. */
  dietaryFlags?: Partial<DietaryTags>;
  /** Backward-compatible generic alias for `dietaryFlags`. */
  flags?: Partial<DietaryTags>;
  imageUrl?: string;
  /** True for items the user created and saved via the Custom Food & Recipe Builder */
  isCustom?: boolean;
}
