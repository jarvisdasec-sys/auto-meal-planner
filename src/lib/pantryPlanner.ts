import { filterFoodsForProfile, filterSnacksByCravings } from './fitnessMealPlanner';
import type { MealWindow, UserProfile } from './fitnessMealPlanner';
import type { CatalogFoodItem, FoodCategory } from './foodCatalog';

// ============================================================
// SHARED MEAL-WINDOW GROUPING (dietary-filtered recommendations)
// ============================================================

type MealWindowProfile = Pick<
  UserProfile,
  'majorAllergens' | 'giConditions' | 'spiceLevel' | 'customExclusions' | 'snackCravings'
>;

export function buildMealWindowGroups(
  foodCatalog: CatalogFoodItem[],
  profile: MealWindowProfile,
): Record<MealWindow, CatalogFoodItem[]> {
  const allowedFoods = filterFoodsForProfile(foodCatalog, profile);
  const result: Record<MealWindow, CatalogFoodItem[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snacks: [],
  };
  for (const food of allowedFoods) {
    for (const window of food.mealWindows) {
      if (window === 'snacks') continue;
      result[window].push(food);
    }
  }
  result.snacks = filterSnacksByCravings(
    allowedFoods.filter((f) => f.mealWindows.includes('snacks')),
    profile.snackCravings,
  ) as CatalogFoodItem[];
  return result;
}

// ============================================================
// ZERO-WASTE & PANTRY INVENTORY ENGINE
// ============================================================

export interface WeeklyMealSlot {
  day: number; // 1-7
  mealWindow: MealWindow;
  food: CatalogFoodItem;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Convert a 1-based plan day number into a weekday label, starting on Sunday (prep day). */
export function getDayName(day: number): string {
  return DAY_NAMES[(day - 1) % 7] ?? `Day ${day}`;
}

/**
 * Build a 7-day meal plan from the available foods per meal window. Days 2-4 deliberately
 * reuse the Day 1 pick for each window first, so partially-used pantry items get finished
 * before new groceries are introduced; days 5-7 cycle through the remaining catalog for variety.
 */
export function generateWeeklyMealPlan(
  foodsByMeal: Record<MealWindow, CatalogFoodItem[]>,
  days = 7,
): WeeklyMealSlot[] {
  const slots: WeeklyMealSlot[] = [];
  const windows: MealWindow[] = ['breakfast', 'lunch', 'dinner', 'snacks'];
  for (const window of windows) {
    const list = foodsByMeal[window];
    if (list.length === 0) continue;
    for (let day = 1; day <= days; day++) {
      const index = day >= 2 && day <= 4 ? 0 : (day - 1) % list.length;
      slots.push({ day, mealWindow: window, food: list[index] });
    }
  }
  return slots;
}

export type PantryStatus = 'to_buy' | 'in_pantry_expiring' | 'in_pantry_stable';

export interface PantryEntry {
  foodId: string;
  name: string;
  category: FoodCategory;
  daysUsed: number[];
  status: PantryStatus;
}

// Vegetables and fresh fats (avocado, etc.) spoil quickly once opened/prepped
const PERISHABLE_CATEGORIES: FoodCategory[] = ['vegetable', 'fat'];

/** Tally how many times each food is used across the week and flag perishable carry-over items. */
export function computePantryInventory(slots: WeeklyMealSlot[]): PantryEntry[] {
  const map = new Map<string, PantryEntry>();
  for (const slot of slots) {
    const existing = map.get(slot.food.id);
    if (existing) {
      existing.daysUsed.push(slot.day);
    } else {
      map.set(slot.food.id, {
        foodId: slot.food.id,
        name: slot.food.name,
        category: slot.food.category,
        daysUsed: [slot.day],
        status: 'to_buy',
      });
    }
  }

  const entries = Array.from(map.values());
  for (const entry of entries) {
    const usedMultipleDays = entry.daysUsed.length > 1;
    if (usedMultipleDays && PERISHABLE_CATEGORIES.includes(entry.category)) {
      entry.status = 'in_pantry_expiring';
    } else if (usedMultipleDays) {
      entry.status = 'in_pantry_stable';
    }
  }

  return entries.sort((a, b) => Number(b.status === 'in_pantry_expiring') - Number(a.status === 'in_pantry_expiring'));
}

export interface UseWhatIHaveSuggestion {
  title: string;
  ingredients: string[];
  note: string;
}

/** Generate a simple "use it up" suggestion from any perishable, multi-day pantry carry-overs. */
export function generateUseWhatIHaveSuggestion(pantry: PantryEntry[]): UseWhatIHaveSuggestion | null {
  const expiring = pantry.filter((entry) => entry.status === 'in_pantry_expiring');
  if (expiring.length === 0) return null;
  return {
    title: `Use-It-Up Bowl: ${expiring.map((entry) => entry.name).join(' + ')}`,
    ingredients: expiring.map((entry) => entry.name),
    note: 'Combine these expiring items into a quick stir-fry, salad, or side dish before they spoil.',
  };
}

// ============================================================
// BATCH MEAL-PREP OPTIMIZER
// ============================================================

export interface BatchPrepItem {
  foodId: string;
  name: string;
  portionCooked: string;
  timesPerWeek: number;
  usage: { day: number; mealWindow: MealWindow }[];
}

/** Aggregate foods reused 2+ times across the week into a bulk-cooking checklist. */
export function aggregateBatchPrepList(slots: WeeklyMealSlot[]): BatchPrepItem[] {
  const map = new Map<string, BatchPrepItem>();
  for (const slot of slots) {
    const existing = map.get(slot.food.id);
    if (existing) {
      existing.timesPerWeek += 1;
      existing.usage.push({ day: slot.day, mealWindow: slot.mealWindow });
    } else {
      map.set(slot.food.id, {
        foodId: slot.food.id,
        name: slot.food.name,
        portionCooked: slot.food.portionCooked,
        timesPerWeek: 1,
        usage: [{ day: slot.day, mealWindow: slot.mealWindow }],
      });
    }
  }
  return Array.from(map.values())
    .filter((item) => item.timesPerWeek > 1)
    .sort((a, b) => b.timesPerWeek - a.timesPerWeek);
}

// ============================================================
// TIME-TO-COOK FILTER
// ============================================================

export type TimeBudget = 'express_5' | 'quick_15' | 'standard_30' | 'batch_prep';

export const TIME_BUDGET_LABELS: Record<TimeBudget, string> = {
  express_5: '5 min (Express)',
  quick_15: '15 min (Quick)',
  standard_30: '30 min (Standard)',
  batch_prep: 'Batch Prep',
};

const TIME_BUDGET_MINUTES: Record<TimeBudget, number> = {
  express_5: 5,
  quick_15: 15,
  standard_30: 30,
  batch_prep: Infinity,
};

/** The fastest total (prep + cook) time across a food's available cooking methods. */
export function getFastestCookingTime(food: CatalogFoodItem): number {
  return Math.min(...food.cookingOptions.map((option) => option.prepTimeMinutes + option.cookTimeMinutes));
}

/** Filter foods down to those preparable within the selected time budget. "Batch Prep" shows everything. */
export function filterFoodsByTimeBudget<T extends CatalogFoodItem>(foods: T[], budget: TimeBudget): T[] {
  if (budget === 'batch_prep') return foods;
  const maxMinutes = TIME_BUDGET_MINUTES[budget];
  return foods.filter((food) => getFastestCookingTime(food) <= maxMinutes);
}
