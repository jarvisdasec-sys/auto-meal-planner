import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE } from '@/store/useMealPlannerStore';
import {
  RECIPE_MEALS,
  aggregateRecipeIngredients,
  createRecipeWeekPlan,
  recipeIngredientQuantities,
  recipeNutrition,
  safeRecipeCandidates,
  type RecipeWeekPreferences,
} from './recipeMeals';

const preferences: RecipeWeekPreferences = { startDateKey: '2026-10-09', diet: 'balanced', maxTotalMinutes: 45 };

describe('quantified complete recipe meals', () => {
  it('ships diverse complete recipes for every recipe-week meal window', () => {
    expect(RECIPE_MEALS.length).toBeGreaterThanOrEqual(12);
    expect(new Set(RECIPE_MEALS.map((recipe) => recipe.mealWindow))).toEqual(new Set(['breakfast', 'lunch', 'dinner', 'snacks']));
    RECIPE_MEALS.forEach((recipe) => {
      expect(recipe.yieldServings).toBeGreaterThan(0);
      expect(recipe.ingredients.every((ingredient) => ingredient.grams > 0)).toBe(true);
      expect(recipe.instructions.length).toBeGreaterThan(1);
      expect(recipe.imageUrl).toMatch(/^\/images\/foods\//);
    });
  });

  it('uses the same measured ingredient quantities to calculate nutrition and household groceries', () => {
    const recipe = RECIPE_MEALS.find((item) => item.id === 'chicken-quinoa-broccoli-bowl')!;
    const personal = recipeIngredientQuantities(recipe, 1);
    const doubled = recipeIngredientQuantities(recipe, 2);
    expect(doubled[0].grams).toBeCloseTo(personal[0].grams * 2);
    const nutrition = recipeNutrition(recipe, 1);
    expect(nutrition.calories).toBeGreaterThan(0);
    expect(nutrition.proteinGrams).toBeGreaterThan(0);
    const weekly = createRecipeWeekPlan(DEFAULT_PROFILE, preferences, { seed: 3, now: '2026-10-01T00:00:00.000Z' });
    const personalGroceries = aggregateRecipeIngredients(weekly.slots, 1);
    const householdGroceries = aggregateRecipeIngredients(weekly.slots, 3);
    expect(householdGroceries.map((item) => item.grams)).toEqual(personalGroceries.map((item) => item.grams * 3));
  });

  it('hard-guards allergy, custom-exclusion, and GI-trigger recipes during generation', () => {
    const protectedProfile = { ...DEFAULT_PROFILE, majorAllergens: ['peanuts' as const], customExclusions: ['chicken'], giConditions: ['low_fodmap_ibs' as const] };
    const candidates = safeRecipeCandidates(protectedProfile, preferences);
    expect(candidates.some((recipe) => recipe.id.includes('peanut'))).toBe(false);
    expect(candidates.some((recipe) => recipe.ingredients.some((ingredient) => ingredient.ingredientId === 'chicken-breast'))).toBe(false);
    expect(candidates.some((recipe) => recipe.ingredients.some((ingredient) => ingredient.ingredientId === 'black-beans'))).toBe(false);
    const plan = createRecipeWeekPlan(protectedProfile, preferences, { seed: 8, now: '2026-10-01T00:00:00.000Z' });
    expect(plan.slots.every((slot) => candidates.some((recipe) => recipe.id === slot.recipeId))).toBe(true);
  });
});

describe('recipe-week selection integrity', () => {
  it('uses bounded stable checklist scopes that change when quantities or household change', async () => {
    const { recipeWeekScope } = await import('./recipeMeals');
    const plan = createRecipeWeekPlan(DEFAULT_PROFILE, preferences, { seed: 3 });
    const scope = recipeWeekScope(plan, 1);
    expect(scope.length).toBeLessThan(100);
    expect(recipeWeekScope({ ...plan, slots: [...plan.slots].reverse() }, 1)).toBe(scope);
    expect(recipeWeekScope(plan, 2)).not.toBe(scope);
    expect(recipeWeekScope({ ...plan, slots: plan.slots.map((slot, index) => index === 0 ? { ...slot, servings: 2 } : slot) }, 1)).not.toBe(scope);
  });
  it('excludes newly blocked choices from every derived view without inventing replacement meals', async () => {
    const { allowedRecipeWeekPlan, RECIPE_MEAL_BY_ID } = await import('./recipeMeals');
    const plan = createRecipeWeekPlan(DEFAULT_PROFILE, preferences, { seed: 3 });
    const safe = allowedRecipeWeekPlan(plan, { ...DEFAULT_PROFILE, customExclusions: ['chicken', 'tofu', 'turkey', 'beef', 'salmon', 'tuna'] });
    expect(safe.slots.length).toBeLessThan(plan.slots.length);
    expect(safe.slots.every(slot => !RECIPE_MEAL_BY_ID[slot.recipeId].ingredients.some(item => ['chicken-breast','tofu','turkey-breast','beef','salmon','tuna'].includes(item.ingredientId)))).toBe(true);
    expect(plan.slots.length).toBe(28);
  });
});
