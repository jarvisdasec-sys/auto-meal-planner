import { describe, expect, it } from 'vitest';
import { addDays, entryDateKey, localDateKey, recordsForDate } from './dateKeys';
import {
  calculateFoodNutrition,
  calculateSmoothAdjustment,
  evaluateDietarySafety,
  getAdjustmentForDate,
} from './fitnessMealPlanner';
import { FOOD_CATALOG, type CatalogFoodItem } from './foodCatalog';
import { estimatePlanGroceryCost, getGroceryRequirements, type PantryStock, type WeeklyMealSlot } from './pantryPlanner';
import { createWeeklyPlan, resolveActiveWeeklyPlan } from './weeklyPlan';
import { DEFAULT_PROFILE } from '@/store/useMealPlannerStore';

const chicken = FOOD_CATALOG.find((food) => food.id === 'grilled-chicken')!;
const bread = FOOD_CATALOG.find((food) => food.id === 'whole-wheat-bread')!;

describe('local date ledger helpers', () => {
  it('uses a validated stored local key before safely falling back to a legacy timestamp', () => {
    const timestamp = '2025-01-02T00:30:00.000Z';
    const fallback = localDateKey(new Date(timestamp));
    expect(entryDateKey({ timestamp })).toBe(fallback);
    expect(entryDateKey({ dateKey: '2025-02-30', timestamp })).toBe(fallback);
    expect(entryDateKey({ dateKey: '2025-01-01', timestamp })).toBe('2025-01-01');
    expect(recordsForDate([{ id: 'legacy', timestamp }, { id: 'stored', dateKey: '2025-01-01', timestamp }], fallback).map((entry) => entry.id))
      .toEqual(fallback === '2025-01-01' ? ['legacy', 'stored'] : ['legacy']);
  });

  it('adds calendar days without UTC key conversion', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2024-02-28', 2)).toBe('2024-03-01');
  });
});

describe('mode-aware nutrition and dietary facts', () => {
  it('uses cooked basis, scales servings, and only adds entered oil once', () => {
    const raw = calculateFoodNutrition(chicken, 'raw', 'grilled', undefined, 1);
    const cooked = calculateFoodNutrition(chicken, 'cooked', 'grilled', undefined, 1);
    const panNoOil = calculateFoodNutrition(chicken, 'raw', 'pan_fried', undefined, 1);
    const panWithOil = calculateFoodNutrition(chicken, 'raw', 'pan_fried', { oilType: 'olive_oil', amount: 1, unit: 'tsp' }, 2);

    expect(cooked.calories).not.toBe(raw.calories);
    expect(cooked.macroBasis).toBe('cooked');
    expect(raw.macroScale).toBe(chicken.caloriesRaw / chicken.caloriesCooked);
    expect(panNoOil.calories).toBe(chicken.caloriesRaw);
    expect(panWithOil.calories).toBe((chicken.caloriesRaw + 41) * 2);
    expect(panWithOil.fatGrams).toBeGreaterThan(panNoOil.fatGrams * 2);
  });

  it('hard-blocks known allergens and leaves unknown manual food explicitly unverified', () => {
    const profile = { ...DEFAULT_PROFILE, majorAllergens: ['wheat' as const], customExclusions: ['cilantro'] };
    expect(evaluateDietarySafety(bread, profile).hardBlocked).toBe(true);
    const manual = evaluateDietarySafety({ name: 'Restaurant special' }, profile);
    expect(manual.hardBlocked).toBe(false);
    expect(manual.verification).toBe('unverified');
    expect(evaluateDietarySafety({ name: 'Salsa', ingredients: ['tomato', 'cilantro'] }, profile).hardBlocked).toBe(true);
  });
});

describe('authoritative plan, pantry, and grocery derivation', () => {
  it('replaces excluded stored slots deterministically and rejects blocked candidates from generation', () => {
    const profile = { ...DEFAULT_PROFILE, majorAllergens: ['wheat' as const] };
    const generated = createWeeklyPlan(FOOD_CATALOG, profile, { startDateKey: '2025-01-06', seed: 42 });
    expect(generated.slots).not.toContainEqual(expect.objectContaining({ foodId: bread.id }));

    const active = resolveActiveWeeklyPlan(
      { startDateKey: '2025-01-06', seed: 42, slots: [{ day: 1, mealWindow: 'breakfast', foodId: bread.id, servings: 1 }] },
      FOOD_CATALOG,
      profile,
    );
    expect(active).toHaveLength(1);
    expect(active[0].food.id).not.toBe(bread.id);
    expect(resolveActiveWeeklyPlan(
      { startDateKey: '2025-01-06', seed: 42, slots: [{ day: 1, mealWindow: 'breakfast', foodId: bread.id, servings: 1 }] },
      FOOD_CATALOG,
      profile,
    )[0].food.id).toBe(active[0].food.id);
  });

  it('aggregates planned servings, subtracts real stock, and marks all-zero custom prices unavailable', () => {
    const slots: WeeklyMealSlot[] = [
      { day: 1, mealWindow: 'lunch', food: chicken, servings: 1 },
      { day: 2, mealWindow: 'dinner', food: chicken, servings: 2 },
    ];
    const stock: PantryStock = { [chicken.id]: { portions: 1 } };
    const requirements = getGroceryRequirements(slots, stock);
    expect(requirements[0]).toMatchObject({ plannedPortions: 3, onHandPortions: 1, toBuyPortions: 2 });

    const zeroPriced = {
      ...chicken,
      id: 'custom-zero-price',
      name: 'Custom scanned item',
      estimatedPrices: Object.fromEntries(Object.keys(chicken.estimatedPrices).map((store) => [store, 0])),
    } as CatalogFoodItem;
    const unknownRequirements = getGroceryRequirements([{ day: 1, mealWindow: 'lunch', food: zeroPriced, servings: 1 }]);
    const cost = estimatePlanGroceryCost(unknownRequirements, [zeroPriced], 'walmart');
    expect(cost).toMatchObject({ subtotal: 0, hasUnknownPrices: true, unknownPriceFoodIds: ['custom-zero-price'] });
  });
});

describe('dated restaurant adjustments', () => {
  it('starts tomorrow, ends after the selected number of days, and leaves legacy undated schedules inactive', () => {
    const plan = calculateSmoothAdjustment(300, 3, '2025-01-10');
    expect(plan).toMatchObject({ startDateKey: '2025-01-11', endDateKey: '2025-01-13', dailyOffset: 100 });
    expect(getAdjustmentForDate(plan, '2025-01-10', 2000)).toBe(0);
    expect(getAdjustmentForDate(plan, '2025-01-11', 2000)).toBe(100);
    expect(getAdjustmentForDate(plan, '2025-01-13', 2000)).toBe(100);
    expect(getAdjustmentForDate(plan, '2025-01-14', 2000)).toBe(0);
    expect(getAdjustmentForDate({ excessCalories: 300, daysToSpread: 3, dailyOffset: 100 }, '2025-01-11')).toBe(0);
  });
});
