// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PROFILE } from './useMealPlannerStore';

const preferences = { startDateKey: '2026-10-09' as const, diet: 'balanced' as const, maxTotalMinutes: 45 as const };

describe('recipe-week persistence and safeguards', () => {
  beforeEach(() => { vi.resetModules(); localStorage.clear(); });

  it('does not overwrite local recipe-week data before hydration and validates persisted values', async () => {
    const { RECIPE_WEEK_STORAGE_KEY, hydrateRecipeWeekStore, useRecipeWeekStore } = await import('./useRecipeWeekStore');
    const saved = { householdSize: 2, favorites: ['blueberry-chia-oats'], lockedSlots: ['1:breakfast'], plan: null, savedWeeks: [], purchased: { scope: ['rolled-oats'] }, prepCompleted: { scope: ['blueberry-chia-oats'] } };
    localStorage.setItem(RECIPE_WEEK_STORAGE_KEY, JSON.stringify(saved));
    useRecipeWeekStore.getState().setHouseholdSize(3);
    expect(JSON.parse(localStorage.getItem(RECIPE_WEEK_STORAGE_KEY)!)).toEqual(saved);
    hydrateRecipeWeekStore();
    expect(useRecipeWeekStore.getState()).toMatchObject({ householdSize: 2, favorites: ['blueberry-chia-oats'], purchased: saved.purchased, prepCompleted: saved.prepCompleted });
    expect(() => useRecipeWeekStore.getState().setHouseholdSize(0)).toThrow('Household');
  });

  it('reconciles an old saved week against the current profile before loading it', async () => {
    const { hydrateRecipeWeekStore, useRecipeWeekStore } = await import('./useRecipeWeekStore');
    hydrateRecipeWeekStore();
    const store = useRecipeWeekStore.getState();
    store.generateRecipeWeek(DEFAULT_PROFILE, preferences);
    store.saveWeek('Chicken week');
    const savedId = useRecipeWeekStore.getState().savedWeeks[0].id;
    const protectedProfile = { ...DEFAULT_PROFILE, customExclusions: ['chicken'] };
    useRecipeWeekStore.getState().loadWeek(savedId, protectedProfile);
    const recipes = await import('@/lib/recipeMeals');
    expect(useRecipeWeekStore.getState().plan?.slots.every((slot) => !recipes.RECIPE_MEAL_BY_ID[slot.recipeId].ingredients.some((ingredient) => ingredient.ingredientId === 'chicken-breast'))).toBe(true);
  });

  it('rejects a manual swap that does not clear current recipe safeguards', async () => {
    const { hydrateRecipeWeekStore, useRecipeWeekStore } = await import('./useRecipeWeekStore');
    hydrateRecipeWeekStore();
    useRecipeWeekStore.getState().generateRecipeWeek({ ...DEFAULT_PROFILE, majorAllergens: ['peanuts'] }, preferences);
    expect(() => useRecipeWeekStore.getState().swapRecipe({ ...DEFAULT_PROFILE, majorAllergens: ['peanuts'] }, 1, 'breakfast', 'peanut-banana-oats')).toThrow('unavailable');
  });
});

describe('full-week checklist persistence', () => {
  it('toggles and hydrates shopping and prep for a real 28-meal scope', async () => {
    vi.resetModules(); localStorage.clear();
    const { hydrateRecipeWeekStore, useRecipeWeekStore } = await import('./useRecipeWeekStore');
    const { recipeWeekScope, aggregateRecipeIngredients } = await import('@/lib/recipeMeals');
    hydrateRecipeWeekStore(); useRecipeWeekStore.getState().generateRecipeWeek(DEFAULT_PROFILE, preferences);
    const plan = useRecipeWeekStore.getState().plan!;
    const scope = recipeWeekScope(plan, 1);
    const ingredientId = aggregateRecipeIngredients(plan.slots)[0].ingredient.id;
    const recipeId = plan.slots[0].recipeId;
    useRecipeWeekStore.getState().togglePurchased(scope, ingredientId);
    useRecipeWeekStore.getState().togglePrep(scope, recipeId);
    vi.resetModules();
    const reloaded = await import('./useRecipeWeekStore'); reloaded.hydrateRecipeWeekStore();
    expect(reloaded.useRecipeWeekStore.getState().purchased[scope]).toEqual([ingredientId]);
    expect(reloaded.useRecipeWeekStore.getState().prepCompleted[scope]).toEqual([recipeId]);
  });
});

describe('recipe transitions preserve user intent', () => {
  it('keeps personal serving quantities when swapping recipes', async () => {
    vi.resetModules(); localStorage.clear();
    const { hydrateRecipeWeekStore, useRecipeWeekStore } = await import('./useRecipeWeekStore');
    hydrateRecipeWeekStore(); useRecipeWeekStore.getState().generateRecipeWeek(DEFAULT_PROFILE, preferences);
    useRecipeWeekStore.getState().setRecipeServings(1, 'breakfast', 1.5);
    useRecipeWeekStore.getState().swapRecipe(DEFAULT_PROFILE, 1, 'breakfast', 'spinach-egg-toast');
    expect(useRecipeWeekStore.getState().plan?.slots.find(slot => slot.day === 1 && slot.mealWindow === 'breakfast')?.servings).toBe(1.5);
  });
  it('drops locks on newly blocked meals replaced during regeneration and safe loading', async () => {
    vi.resetModules(); localStorage.clear();
    const { hydrateRecipeWeekStore, useRecipeWeekStore } = await import('./useRecipeWeekStore');
    hydrateRecipeWeekStore(); useRecipeWeekStore.getState().generateRecipeWeek(DEFAULT_PROFILE, preferences);
    useRecipeWeekStore.getState().swapRecipe(DEFAULT_PROFILE, 1, 'breakfast', 'spinach-egg-toast');
    useRecipeWeekStore.getState().toggleLock(1, 'breakfast'); useRecipeWeekStore.getState().saveWeek('Egg week');
    const id = useRecipeWeekStore.getState().savedWeeks[0].id;
    const profile = { ...DEFAULT_PROFILE, majorAllergens: ['eggs' as const] };
    useRecipeWeekStore.getState().regenerateUnlocked(profile);
    expect(useRecipeWeekStore.getState().lockedSlots).not.toContain('1:breakfast');
    useRecipeWeekStore.getState().loadWeek(id, profile);
    expect(useRecipeWeekStore.getState().lockedSlots).not.toContain('1:breakfast');
  });
  it('does not flag writable browser storage unavailable merely because a snapshot is corrupt', async () => {
    vi.resetModules(); localStorage.clear();
    const { hydrateRecipeWeekStore, useRecipeWeekStore, RECIPE_WEEK_STORAGE_KEY } = await import('./useRecipeWeekStore');
    localStorage.setItem(RECIPE_WEEK_STORAGE_KEY, '{broken'); hydrateRecipeWeekStore();
    expect(useRecipeWeekStore.getState().storageAvailable).toBe(true);
    useRecipeWeekStore.getState().generateRecipeWeek(DEFAULT_PROFILE, preferences);
    expect(JSON.parse(localStorage.getItem(RECIPE_WEEK_STORAGE_KEY)!)).toHaveProperty('plan');
  });
});
