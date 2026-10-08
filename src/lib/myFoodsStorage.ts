import type { NutritionItem, NutritionCategory, ServingUnit } from '@/types/nutrition';
import { sanitizeRemoteUrl } from './imageHosts';

const STORAGE_KEY = 'btb-meal-planner:my-foods';
const SERVING_UNITS: readonly ServingUnit[] = ['g', 'oz', 'cup', 'scoop', 'slice', 'tbsp', 'tsp', 'piece', 'ml', 'serving'];
const NUTRITION_CATEGORIES: readonly NutritionCategory[] = [
  'red_meat', 'poultry', 'fish', 'shellfish', 'eggs', 'dairy_milk', 'cheese', 'yogurt', 'grains', 'bread_bakery',
  'pasta', 'rice', 'cereal', 'legumes', 'nuts', 'seeds', 'vegetables', 'leafy_greens', 'cruciferous_vegetables',
  'root_vegetables', 'fruits', 'berries', 'citrus_fruits', 'tropical_fruits', 'fats_oils', 'condiments',
  'sauces_dressings', 'spices_herbs', 'beverages', 'alcohol', 'snacks', 'sweets_desserts', 'baked_goods',
  'fast_food', 'soups_stews', 'supplement',
];

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string' && entry.trim().length > 0);
}

/** Reject malformed persisted values rather than letting unsafe records reach renderer or logger state. */
export function isStoredNutritionItem(value: unknown): value is NutritionItem {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Partial<NutritionItem>;
  if (
    typeof item.id !== 'string' || !item.id.trim() ||
    typeof item.name !== 'string' || !item.name.trim() ||
    !NUTRITION_CATEGORIES.includes(item.category as NutritionCategory) ||
    typeof item.isSupplement !== 'boolean' ||
    !item.servingSize || typeof item.servingSize !== 'object' ||
    !isNonNegativeNumber(item.servingSize.amount) || item.servingSize.amount <= 0 ||
    !SERVING_UNITS.includes(item.servingSize.unit) ||
    !isNonNegativeNumber(item.calories) || !isNonNegativeNumber(item.proteinGrams) ||
    !isNonNegativeNumber(item.carbGrams) || !isNonNegativeNumber(item.fatGrams) ||
    !isStringList(item.dietaryTags)
  ) return false;
  if (item.imageUrl !== undefined && !sanitizeRemoteUrl(item.imageUrl)) return false;
  if (item.ingredients !== undefined && !isStringList(item.ingredients)) return false;
  if (item.allergens !== undefined && !isStringList(item.allergens)) return false;
  return true;
}

/** Load valid user-created custom foods only (empty on the server, malformed JSON, or blocked storage). */
export function loadMyFoods(): NutritionItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isStoredNutritionItem) : [];
  } catch {
    return [];
  }
}

/**
 * Persist a fully validated My Foods collection. Returns false on validation, quota,
 * privacy-mode, or serialization failures so callers can retain the in-memory draft
 * and show an actionable message instead of reporting a false save.
 */
export function saveMyFoods(items: NutritionItem[]): boolean {
  if (typeof window === 'undefined' || !Array.isArray(items) || !items.every(isStoredNutritionItem)) return false;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}
