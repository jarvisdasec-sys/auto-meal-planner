import { calculateFoodNutrition, type MealWindow } from './fitnessMealPlanner';
import { addDays, type DateKey } from './dateKeys';
import type { WeeklyMealSlot } from './pantryPlanner';

export const MEAL_WINDOWS: MealWindow[] = ['breakfast', 'lunch', 'dinner', 'snacks'];
export const MEAL_LABELS: Record<MealWindow, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snacks: 'Snacks' };
export const FOOD_SAFETY_URL = 'https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/leftovers-and-food-safety';

export function validateHouseholdSize(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 12) throw new Error('Household size must be a whole number from 1 to 12.');
  return value;
}

/** Household planning never modifies the personal servings used for nutrition logging. */
export function scalePlanForHousehold(slots: WeeklyMealSlot[], householdSize: number): WeeklyMealSlot[] {
  const multiplier = validateHouseholdSize(householdSize);
  return slots.map((slot) => ({ ...slot, servings: (slot.servings ?? 1) * multiplier }));
}

export function planFingerprint(startDate: string | undefined, slots: WeeklyMealSlot[], householdSize = 1): string {
  const serialized = `${startDate ?? 'none'}|${householdSize}|${slots.map((s) => `${s.day}:${s.mealWindow}:${s.food.id}:${s.servings ?? 1}`).sort().join('|')}`;
  let hash = 2166136261;
  for (let i = 0; i < serialized.length; i += 1) hash = Math.imul(hash ^ serialized.charCodeAt(i), 16777619) >>> 0;
  return `plan-${hash.toString(16)}`;
}

export function plannedNutrition(slots: WeeklyMealSlot[]) {
  return slots.reduce((totals, slot) => {
    const nutrition = calculateFoodNutrition(slot.food, 'cooked', slot.food.cookingOptions[0]?.method ?? 'raw', undefined, slot.servings ?? 1);
    return { calories: totals.calories + nutrition.calories, proteinGrams: totals.proteinGrams + nutrition.proteinGrams, carbGrams: totals.carbGrams + nutrition.carbGrams, fatGrams: totals.fatGrams + nutrition.fatGrams };
  }, { calories: 0, proteinGrams: 0, carbGrams: 0, fatGrams: 0 });
}

export interface PrepBatch {
  foodId: string;
  name: string;
  category: string;
  servings: number;
  portionRaw: string;
  portionCooked: string;
  method: string;
  prepMinutes: number;
  cookMinutes: number;
  cookingTip?: string;
  uses: { day: number; mealWindow: MealWindow; date: DateKey }[];
}

/** All planned foods are included, not just repetitions. Times are catalog estimates per batch. */
export function buildPrepBatches(slots: WeeklyMealSlot[], startDate: DateKey, householdSize = 1): PrepBatch[] {
  const batches = new Map<string, PrepBatch>();
  for (const slot of scalePlanForHousehold(slots, householdSize)) {
    const existing = batches.get(slot.food.id);
    const use = { day: slot.day, mealWindow: slot.mealWindow, date: addDays(startDate, slot.day - 1) };
    if (existing) { existing.servings += slot.servings ?? 1; existing.uses.push(use); }
    else {
      const option = slot.food.cookingOptions[0];
      batches.set(slot.food.id, { foodId: slot.food.id, name: slot.food.name, category: slot.food.category, servings: slot.servings ?? 1, portionRaw: slot.food.portionRaw, portionCooked: slot.food.portionCooked, method: option?.method ?? 'raw', prepMinutes: option?.prepTimeMinutes ?? 0, cookMinutes: option?.cookTimeMinutes ?? 0, cookingTip: option?.cookingTip, uses: [use] });
    }
  }
  return [...batches.values()].sort((a, b) => b.servings - a.servings || a.name.localeCompare(b.name));
}

export function storageGuidance(prepDate: DateKey, eatDate: DateKey, method: string): string {
  if (method === 'raw') return 'Follow the package date; assemble fresh when practical.';
  if (eatDate < prepDate) return 'Meal falls before this prep date — prepare earlier or choose a different session.';
  if (eatDate > addDays(prepDate, 3)) return 'Freeze promptly or prepare in a later session; thaw safely before eating.';
  return `Refrigerate promptly at 40°F or below; use within 3–4 days. Reheat leftovers to 165°F.`;
}

/** Escape CSV and prevent spreadsheet formula execution from user-entered names or notes. */
export function toCsv(rows: (string | number | undefined)[][]): string {
  return '\uFEFF' + rows.map((row) => row.map((value) => {
    let text = String(value ?? '');
    if (/^[\s]*[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  }).join(',')).join('\r\n');
}

export function weeklyPlanCsv(slots: WeeklyMealSlot[], startDate: DateKey): string {
  return toCsv([['Date', 'Meal', 'Food', 'Personal servings', 'Cooked portion per serving', 'Estimated calories', 'Protein g', 'Carbs g', 'Fat g'], ...slots.map((slot) => {
    const n = plannedNutrition([slot]);
    return [addDays(startDate, slot.day - 1), MEAL_LABELS[slot.mealWindow], slot.food.name, slot.servings ?? 1, slot.food.portionCooked, n.calories, n.proteinGrams.toFixed(1), n.carbGrams.toFixed(1), n.fatGrams.toFixed(1)];
  })]);
}

export function downloadText(filename: string, text: string, mimeType = 'text/csv;charset=utf-8'): void {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
