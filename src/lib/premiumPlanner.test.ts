import { describe, expect, it } from 'vitest';
import { FOOD_CATALOG } from './foodCatalog';
import { aggregateBatchPrepList, computePantryInventory, getGroceryRequirements, type WeeklyMealSlot } from './pantryPlanner';
import { buildPrepBatches, planFingerprint, plannedNutrition, scalePlanForHousehold, storageGuidance, toCsv, weeklyPlanCsv } from './premiumPlanner';

const food = FOOD_CATALOG.find((f) => f.id === 'grilled-chicken')!;
const slots: WeeklyMealSlot[] = [
  { day: 1, mealWindow: 'lunch', food, servings: 2 },
  { day: 5, mealWindow: 'dinner', food, servings: 1.5 },
];

describe('premium meal-planning helpers', () => {
  it('scales shopping/prep quantities without mutating personal plan servings', () => {
    const scaled = scalePlanForHousehold(slots, 3);
    expect(scaled.map((s) => s.servings)).toEqual([6, 4.5]);
    expect(slots.map((s) => s.servings)).toEqual([2, 1.5]);
    expect(() => scalePlanForHousehold(slots, 0)).toThrow('Household');
    expect(() => scalePlanForHousehold(slots, 1.5)).toThrow('Household');
  });
  it('builds prep batches with actual fractional serving sums and usage dates', () => {
    const batches = buildPrepBatches(slots, '2026-10-09', 2);
    expect(batches).toHaveLength(1);
    expect(batches[0].servings).toBe(7);
    expect(batches[0].uses.map((u) => u.date)).toEqual(['2026-10-09', '2026-10-13']);
    expect(aggregateBatchPrepList(slots)[0].timesPerWeek).toBe(3.5);
  });
  it('includes a singly used planned food in the dedicated prep workspace', () => {
    expect(buildPrepBatches([slots[0]], '2026-10-09')[0].servings).toBe(2);
  });
  it('scopes records to changed dates, food, servings, or household, independent of slot order', () => {
    const key = planFingerprint('2026-10-09', slots, 1);
    expect(key).toBe(planFingerprint('2026-10-09', [...slots].reverse(), 1));
    expect(key).not.toBe(planFingerprint('2026-10-10', slots, 1));
    expect(key).not.toBe(planFingerprint('2026-10-09', slots, 2));
    expect(key).not.toBe(planFingerprint('2026-10-09', [{ ...slots[0], servings: 3 }], 1));
  });
  it('warns later-week cooked portions to freeze or use a second session', () => {
    expect(storageGuidance('2026-10-09', '2026-10-12', 'grilled')).toContain('3–4 days');
    expect(storageGuidance('2026-10-09', '2026-10-13', 'grilled')).toContain('Freeze');
    expect(storageGuidance('2026-10-09', '2026-10-08', 'grilled')).toContain('before');
    expect(storageGuidance('2026-10-09', '2026-10-15', 'raw')).toContain('package');
  });
  it('does not subtract expired recorded stock from a shopping requirement', () => {
    const inventory = computePantryInventory(slots, { [food.id]: { portions: 10, expiresOn: '2020-01-01' } }, '2026-10-09');
    expect(inventory[0]).toMatchObject({ status: 'expired', onHandPortions: 0, toBuyPortions: 3.5 });
    expect(getGroceryRequirements(slots, { [food.id]: { portions: 10, expiresOn: '2020-01-01' } })[0].toBuyPortions).toBe(3.5);
  });
  it('escapes CSV quotes and neutralizes spreadsheet formula injection', () => {
    const csv = toCsv([['=HYPERLINK("bad")', 'normal,food', '"quoted"'], [' +1', 25, '@SUM(A1)']]);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain('"normal,food"');
    expect(csv).toContain('""quoted""');
    expect(csv).toContain("'@SUM(A1)");
  });
  it('exports personal servings and estimated cooked totals for actual dates', () => {
    const csv = weeklyPlanCsv(slots, '2026-10-09');
    expect(csv).toContain('2026-10-13');
    expect(csv).toContain('Personal servings');
    expect(plannedNutrition(slots).calories).toBeGreaterThan(0);
  });
});
