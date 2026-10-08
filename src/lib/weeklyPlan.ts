import { addDays, isDateKey, localDateKey, type DateKey } from './dateKeys';
import { evaluateDietarySafety, type MealWindow, type UserProfile } from './fitnessMealPlanner';
import type { CatalogFoodItem } from './foodCatalog';
import { buildMealWindowGroups, type WeeklyMealSlot } from './pantryPlanner';

export interface PersistedWeeklyPlanSlot {
  day: number;
  mealWindow: MealWindow;
  foodId: string;
  servings: number;
}

export interface PersistedWeeklyPlan {
  startDateKey: DateKey;
  seed: number;
  slots: PersistedWeeklyPlanSlot[];
}

const WINDOWS: MealWindow[] = ['breakfast', 'lunch', 'dinner', 'snacks'];

export function getWeeklyPlanStartDateKey(date: Date = new Date()): DateKey {
  return localDateKey(date);
}

export function getWeeklyPlanDate(plan: Pick<PersistedWeeklyPlan, 'startDateKey'>, day: number): DateKey {
  if (!Number.isInteger(day) || day < 1 || day > 7) throw new Error('Plan day must be between 1 and 7.');
  return addDays(plan.startDateKey, day - 1);
}

function normalizedSeed(seed?: number): number {
  if (typeof seed === 'number' && Number.isSafeInteger(seed)) return Math.abs(seed) || 1;
  return Math.floor(Math.random() * 2_147_483_647) || 1;
}

/** Small deterministic PRNG; a stored seed makes replacements reproducible after reload. */
function pickIndex(seed: number, position: number, length: number): number {
  const mixed = Math.imul(seed ^ Math.imul(position + 1, 0x9e3779b1), 0x85ebca6b) >>> 0;
  return mixed % length;
}

export function createWeeklyPlan(
  foodCatalog: CatalogFoodItem[],
  profile: Pick<UserProfile, 'majorAllergens' | 'giConditions' | 'spiceLevel' | 'customExclusions' | 'snackCravings'>,
  options: { startDateKey?: DateKey; seed?: number; days?: number } = {},
): PersistedWeeklyPlan {
  const startDateKey = options.startDateKey ?? getWeeklyPlanStartDateKey();
  if (!isDateKey(startDateKey)) throw new Error('Weekly plan start date must be a valid local date key.');
  const seed = normalizedSeed(options.seed);
  const days = options.days ?? 7;
  if (!Number.isInteger(days) || days < 1 || days > 7) throw new Error('Plan length must be between 1 and 7 days.');
  const groups = buildMealWindowGroups(foodCatalog, profile);
  const slots: PersistedWeeklyPlanSlot[] = [];

  for (const mealWindow of WINDOWS) {
    const candidates = groups[mealWindow];
    for (let day = 1; day <= days; day += 1) {
      if (candidates.length === 0) continue;
      const food = candidates[pickIndex(seed, WINDOWS.indexOf(mealWindow) * 7 + day - 1, candidates.length)];
      slots.push({ day, mealWindow, foodId: food.id, servings: 1 });
    }
  }
  return { startDateKey, seed, slots };
}

function candidateForSlot(
  catalog: CatalogFoodItem[],
  profile: Pick<UserProfile, 'majorAllergens' | 'giConditions' | 'spiceLevel' | 'customExclusions' | 'snackCravings'>,
  slot: PersistedWeeklyPlanSlot,
  seed: number,
): CatalogFoodItem | undefined {
  const candidates = buildMealWindowGroups(catalog, profile)[slot.mealWindow]
    .filter((food) => !evaluateDietarySafety(food, profile).hardBlocked);
  if (!candidates.length) return undefined;
  const position = WINDOWS.indexOf(slot.mealWindow) * 7 + slot.day - 1;
  return candidates[pickIndex(seed, position, candidates.length)];
}

/**
 * Resolve stored ids to live catalog objects without mutating persisted state. Missing
 * or newly excluded ids are deterministically replaced when a safe candidate exists.
 */
export function resolveActiveWeeklyPlan(
  plan: PersistedWeeklyPlan | null | undefined,
  catalog: CatalogFoodItem[],
  profile: Pick<UserProfile, 'majorAllergens' | 'giConditions' | 'spiceLevel' | 'customExclusions' | 'snackCravings'>,
): WeeklyMealSlot[] {
  if (!plan || !isDateKey(plan.startDateKey) || !Number.isSafeInteger(plan.seed) || !Array.isArray(plan.slots)) return [];
  const seen = new Set<string>();
  const slots: WeeklyMealSlot[] = [];
  for (const slot of plan.slots) {
    if (!Number.isInteger(slot.day) || slot.day < 1 || slot.day > 7 || !WINDOWS.includes(slot.mealWindow)) continue;
    if (typeof slot.foodId !== 'string' || !Number.isFinite(slot.servings) || slot.servings <= 0) continue;
    const key = `${slot.day}:${slot.mealWindow}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const selected = catalog.find((food) => food.id === slot.foodId);
    const food = selected && selected.mealWindows.includes(slot.mealWindow) && !evaluateDietarySafety(selected, profile).hardBlocked
      ? selected
      : candidateForSlot(catalog, profile, slot, plan.seed);
    if (food) slots.push({ day: slot.day, mealWindow: slot.mealWindow, food, servings: slot.servings });
  }
  return slots.sort((left, right) => left.day - right.day || WINDOWS.indexOf(left.mealWindow) - WINDOWS.indexOf(right.mealWindow));
}
