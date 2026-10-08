import { entryDateKey, recordsForDate, type DateKey } from './dateKeys';

export interface NutritionSnapshot {
  calories: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
}

export interface FoodEntryLike {
  foodId: string;
  calories: number;
  proteinGrams?: number;
  carbGrams?: number;
  fatGrams?: number;
  dateKey?: string;
  timestamp?: string;
}

export interface CatalogNutritionLike {
  id: string;
  caloriesRaw?: number;
  proteinGrams?: number;
  carbGrams?: number;
  fatGrams?: number;
}

function finiteOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * The persisted entry snapshot wins. Catalog lookup is used only to render legacy
 * entries that pre-date stored macro snapshots.
 */
export function getEntryNutrition<T extends FoodEntryLike>(entry: T, catalog: readonly CatalogNutritionLike[] = []): NutritionSnapshot {
  const fallback = catalog.find((food) => food.id === entry.foodId);
  return {
    calories: finiteOrZero(entry.calories ?? fallback?.caloriesRaw),
    proteinGrams: finiteOrZero(entry.proteinGrams ?? fallback?.proteinGrams),
    carbGrams: finiteOrZero(entry.carbGrams ?? fallback?.carbGrams),
    fatGrams: finiteOrZero(entry.fatGrams ?? fallback?.fatGrams),
  };
}

export function getFoodEntriesForDate<T extends FoodEntryLike>(entries: readonly T[], dateKey: DateKey): T[] {
  return recordsForDate(entries, dateKey);
}

export function getExerciseEntriesForDate<T extends { dateKey?: string; timestamp?: string }>(entries: readonly T[], dateKey: DateKey): T[] {
  return recordsForDate(entries, dateKey);
}

export function getHydrationEntriesForDate<T extends { dateKey?: string; timestamp?: string }>(entries: readonly T[], dateKey: DateKey): T[] {
  return recordsForDate(entries, dateKey);
}

export interface DailyNutritionTotals extends NutritionSnapshot {
  entryCount: number;
}

export function calculateDailyNutritionTotals<T extends FoodEntryLike>(
  entries: readonly T[],
  dateKey: DateKey,
  catalog: readonly CatalogNutritionLike[] = [],
): DailyNutritionTotals {
  return getFoodEntriesForDate(entries, dateKey).reduce<DailyNutritionTotals>(
    (total, entry) => {
      const snapshot = getEntryNutrition(entry, catalog);
      return {
        calories: total.calories + snapshot.calories,
        proteinGrams: total.proteinGrams + snapshot.proteinGrams,
        carbGrams: total.carbGrams + snapshot.carbGrams,
        fatGrams: total.fatGrams + snapshot.fatGrams,
        entryCount: total.entryCount + 1,
      };
    },
    { calories: 0, proteinGrams: 0, carbGrams: 0, fatGrams: 0, entryCount: 0 },
  );
}

export { entryDateKey };
