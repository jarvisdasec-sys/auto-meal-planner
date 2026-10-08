// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FOOD_CATALOG } from '@/lib/foodCatalog';
import { localDateKey } from '@/lib/dateKeys';
import {
  DEFAULT_PROFILE,
  MEAL_PLANNER_STORAGE_KEY,
  getActiveWeeklyPlan,
  hydrateMealPlannerStore,
  useMealPlannerStore,
} from './useMealPlannerStore';

function resetStore() {
  useMealPlannerStore.setState({
    profile: DEFAULT_PROFILE,
    foodCatalog: FOOD_CATALOG,
    exerciseLogs: [],
    loggedFoods: [],
    hydrationLogs: [],
    savedRecipes: [],
    weeklyPlan: null,
    pantryStock: {},
    calorieAdjustmentPlan: null,
    hasHydrated: false,
  });
}

describe('meal planner store foundations', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetStore();
  });

  it('rejects invalid profile and input mutations without changing existing state', () => {
    const before = useMealPlannerStore.getState().profile;
    expect(() => useMealPlannerStore.getState().updateProfile({ age: Number.NaN })).toThrow('Age must be a finite number');
    expect(useMealPlannerStore.getState().profile).toEqual(before);
    expect(() => useMealPlannerStore.getState().addHydration(-8)).toThrow('Water amount');
    expect(useMealPlannerStore.getState().hydrationLogs).toEqual([]);
    expect(() => useMealPlannerStore.getState().addExerciseLog({ activityName: '', durationMinutes: 20, caloriesBurned: 100 })).toThrow('Activity name');
    expect(useMealPlannerStore.getState().exerciseLogs).toEqual([]);
    expect(() => useMealPlannerStore.getState().logFood('manual', 'Manual food', -1, 'raw', 'raw')).toThrow('Calories');
    expect(useMealPlannerStore.getState().loggedFoods).toEqual([]);
  });

  it('stores one catalog nutrition snapshot on creation and atomically recomputes calories and macros on cooking edits', () => {
    const chicken = FOOD_CATALOG.find((food) => food.id === 'grilled-chicken')!;
    useMealPlannerStore.getState().logFood(chicken.id, chicken.name, 1, 'cooked', 'grilled', undefined, 'dinner', {
      proteinGrams: 0,
      carbGrams: 0,
      fatGrams: 0,
    }, { servings: 2 });
    const created = useMealPlannerStore.getState().loggedFoods[0];
    expect(created.calories).toBeGreaterThan(1);
    expect(created.proteinGrams ?? 0).toBeGreaterThan(0);
    expect(created.mealType).toBe('dinner');
    expect(created.servings).toBe(2);

    useMealPlannerStore.getState().updateLoggedFoodCooking(created.id, 'pan_fried', 'olive_oil', 1, 'tbsp');
    const edited = useMealPlannerStore.getState().loggedFoods[0];
    expect(edited.id).toBe(created.id);
    expect(edited.timestamp).toBe(created.timestamp);
    expect(edited.calories).toBe((chicken.caloriesCooked + 124) * 2);
    expect(edited.fatGrams ?? 0).toBeGreaterThan(created.fatGrams ?? 0);
  });

  it('uses selected local date keys for hydration and date-scoped ledger totals', () => {
    useMealPlannerStore.getState().addHydration(16, '2025-01-02');
    useMealPlannerStore.getState().addHydration(8, '2025-01-03');
    expect(useMealPlannerStore.getState().getHydrationForDate('2025-01-02')).toHaveLength(1);
    expect(useMealPlannerStore.getState().getHydrationForDate('2025-01-03')).toHaveLength(1);
    expect(useMealPlannerStore.getState().totalConsumedCalories(localDateKey())).toBe(0);
  });

  it('persists generated slots and blocks an excluded substitution while resolving a safe active plan', () => {
    useMealPlannerStore.getState().generateWeeklyPlan({ startDateKey: '2025-01-06', seed: 21 });
    const initial = useMealPlannerStore.getState().weeklyPlan;
    expect(initial?.startDateKey).toBe('2025-01-06');
    const chicken = FOOD_CATALOG.find((food) => food.id === 'grilled-chicken')!;
    useMealPlannerStore.getState().substituteWeeklyPlanSlot(1, 'lunch', chicken.id, 2);
    expect(useMealPlannerStore.getState().weeklyPlan?.slots).toContainEqual(
      expect.objectContaining({ day: 1, mealWindow: 'lunch', foodId: chicken.id, servings: 2 }),
    );

    useMealPlannerStore.getState().updateProfile({ majorAllergens: ['wheat'] });
    expect(() => useMealPlannerStore.getState().substituteWeeklyPlanSlot(1, 'breakfast', 'whole-wheat-bread')).toThrow('excluded');
    expect(getActiveWeeklyPlan(useMealPlannerStore.getState()).every((slot) => slot.food.id !== 'whole-wheat-bread')).toBe(true);
  });

  it('does not read or write browser storage until explicit safe hydration', () => {
    const getItem = vi.spyOn(window.localStorage, 'getItem');
    const setItem = vi.spyOn(window.localStorage, 'setItem');
    expect(useMealPlannerStore.getState().hasHydrated).toBe(false);
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();

    window.localStorage.setItem(MEAL_PLANNER_STORAGE_KEY, JSON.stringify({
      loggedFoods: [{ id: 'legacy', foodId: 'legacy', name: 'Legacy', calories: 10, portionMode: 'raw', cookingMethod: 'raw', timestamp: '2025-01-02T00:00:00.000Z' }],
    }));
    const writesBeforeHydration = setItem.mock.calls.length;
    hydrateMealPlannerStore();
    expect(useMealPlannerStore.getState().hasHydrated).toBe(true);
    expect(useMealPlannerStore.getState().loggedFoods).toHaveLength(1);
    // Hydration reads persisted data but never automatically rewrites it.
    expect(setItem.mock.calls.length).toBe(writesBeforeHydration);
  });
});
