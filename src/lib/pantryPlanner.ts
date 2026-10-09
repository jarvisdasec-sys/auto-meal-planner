import { filterFoodsForProfile, filterSnacksByCravings } from './fitnessMealPlanner';
import type { FoodItem, MealWindow, StoreName, UserProfile } from './fitnessMealPlanner';
import type { CatalogFoodItem, FoodCategory } from './foodCatalog';
import { addDays, compareDateKeys, isDateKey, localDateKey, type DateKey } from './dateKeys';

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
  /** Planned portions for this slot. Legacy callers may omit it and get one portion. */
  servings?: number;
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
      slots.push({ day, mealWindow: window, food: list[index], servings: 1 });
    }
  }
  return slots;
}

export type PantryStatus = 'to_buy' | 'in_pantry_expiring' | 'in_pantry_stable' | 'expired';

export interface PantryEntry {
  foodId: string;
  name: string;
  category: FoodCategory;
  daysUsed: number[];
  status: PantryStatus;
  plannedPortions: number;
  onHandPortions: number;
  toBuyPortions: number;
  /** Only populated from an actual user-entered inventory date. */
  expiresOn?: DateKey;
  expiryKnown: boolean;
}

export interface PantryStockEntry {
  portions: number;
  expiresOn?: DateKey;
}

export type PantryStock = Record<string, PantryStockEntry>;

/**
 * Tally planned portions and subtract only explicitly entered pantry stock. Reuse
 * across days is useful prep information, not evidence an item is in the pantry
 * or expiring. An expiring label requires an actual stored expiry date.
 */
export function computePantryInventory(slots: WeeklyMealSlot[], pantryStock: PantryStock = {}, today: DateKey = localDateKey()): PantryEntry[] {
  const map = new Map<string, PantryEntry>();
  for (const slot of slots) {
    const existing = map.get(slot.food.id);
    const servings = typeof slot.servings === 'number' && Number.isFinite(slot.servings) && slot.servings > 0 ? slot.servings : 1;
    if (existing) {
      existing.daysUsed.push(slot.day);
      existing.plannedPortions += servings;
    } else {
      const stock = pantryStock[slot.food.id];
      const expiresOn = isDateKey(stock?.expiresOn) ? stock.expiresOn : undefined;
      const expired = Boolean(expiresOn && expiresOn < today);
      const onHandPortions = !expired && typeof stock?.portions === 'number' && Number.isFinite(stock.portions) && stock.portions > 0 ? stock.portions : 0;
      map.set(slot.food.id, {
        foodId: slot.food.id,
        name: slot.food.name,
        category: slot.food.category,
        daysUsed: [slot.day],
        status: expired ? 'expired' : 'to_buy',
        plannedPortions: servings,
        onHandPortions,
        toBuyPortions: Math.max(0, servings - onHandPortions),
        expiresOn,
        expiryKnown: Boolean(expiresOn),
      });
    }
  }

  const entries = Array.from(map.values());
  for (const entry of entries) {
    entry.toBuyPortions = Math.max(0, entry.plannedPortions - entry.onHandPortions);
    const isRecordedNearExpiry = entry.expiresOn
      && compareDateKeys(entry.expiresOn, today) >= 0
      && compareDateKeys(entry.expiresOn, addDays(today, 3)) <= 0 ? true : false;
    // This label is based only on the recorded date, never category or repeat use.
    if (entry.onHandPortions > 0 && isRecordedNearExpiry) {
      entry.status = 'in_pantry_expiring';
    } else if (entry.onHandPortions > 0) {
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
    note: 'These items have a recorded expiry date within the next three days; check their condition and labels before using them.',
  };
}

export interface GroceryRequirement {
  foodId: string;
  name: string;
  category: FoodCategory;
  portionLabel: string;
  plannedPortions: number;
  onHandPortions: number;
  toBuyPortions: number;
  expiresOn?: DateKey;
}

/** Aggregate the authoritative plan by id and its actual selected serving counts. */
export function getGroceryRequirements(slots: WeeklyMealSlot[], pantryStock: PantryStock = {}): GroceryRequirement[] {
  return computePantryInventory(slots, pantryStock).map((entry) => {
    const food = slots.find((slot) => slot.food.id === entry.foodId)?.food;
    return {
      foodId: entry.foodId,
      name: entry.name,
      category: entry.category,
      portionLabel: food?.portionCooked ?? 'portion',
      plannedPortions: entry.plannedPortions,
      onHandPortions: entry.onHandPortions,
      toBuyPortions: entry.toBuyPortions,
      expiresOn: entry.expiresOn,
    };
  });
}

export interface PlanGroceryCost {
  store: StoreName;
  subtotal: number;
  /** true when at least one required item lacks a usable price, so totals are partial. */
  hasUnknownPrices: boolean;
  unknownPriceFoodIds: string[];
}

function knownPriceForStore(food: FoodItem, store: StoreName): number | undefined {
  const explicit = food.knownPrices?.[store];
  if (typeof explicit === 'number' && Number.isFinite(explicit) && explicit >= 0) return explicit;
  if (food.priceAvailability?.[store] === false) return undefined;
  const estimated = food.estimatedPrices?.[store];
  const allEstimatedPricesAreZero = Object.values(food.estimatedPrices ?? {}).every((price) => price === 0);
  if (typeof estimated !== 'number' || !Number.isFinite(estimated) || estimated < 0 || (estimated === 0 && allEstimatedPricesAreZero)) return undefined;
  return estimated;
}

/** Price only the plan requirements that remain to buy; unavailable data makes a partial total, never a free item. */
export function estimatePlanGroceryCost(
  requirements: GroceryRequirement[],
  catalog: readonly FoodItem[],
  store: StoreName,
): PlanGroceryCost {
  let subtotal = 0;
  const unknownPriceFoodIds: string[] = [];
  for (const requirement of requirements) {
    if (requirement.toBuyPortions <= 0) continue;
    const food = catalog.find((item) => item.id === requirement.foodId);
    const price = food ? knownPriceForStore(food, store) : undefined;
    if (price === undefined) unknownPriceFoodIds.push(requirement.foodId);
    else subtotal += price * requirement.toBuyPortions;
  }
  return { store, subtotal, hasUnknownPrices: unknownPriceFoodIds.length > 0, unknownPriceFoodIds };
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
    const servings = slot.servings ?? 1;
    if (existing) {
      existing.timesPerWeek += servings;
      existing.usage.push({ day: slot.day, mealWindow: slot.mealWindow });
    } else {
      map.set(slot.food.id, {
        foodId: slot.food.id,
        name: slot.food.name,
        portionCooked: slot.food.portionCooked,
        timesPerWeek: servings,
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
