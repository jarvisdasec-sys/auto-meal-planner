// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DEFAULT_PROFILE, useMealPlannerStore, type SavedRecipe } from '@/store/useMealPlannerStore';
import RecipeBox from './RecipeBox';

vi.mock('next/image', () => ({
  default: ({ alt, src }: { alt?: string; src?: string }) => createElement('img', { alt: alt ?? '', src: src ?? '' }),
}));

const reactEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
reactEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

const detailedRecipe: SavedRecipe = {
  id: 'fixture-detailed',
  name: 'Fixture Garden Bowl',
  calories: 240,
  proteinGrams: 12,
  carbGrams: 30,
  fatGrams: 8,
  mealWindow: 'dinner',
  servings: 4,
  ingredients: ['quinoa', 'roasted vegetables'],
  instructions: ['Roast vegetables.', 'Combine with quinoa.'],
  imageUrl: 'https://images.unsplash.com/fixture-garden-bowl',
  portionMode: 'cooked',
  cookingMethod: 'baked',
  oilAddition: { oilType: 'olive_oil', amount: 1, unit: 'tsp', addedCalories: 41, addedFatGrams: 4.7 },
  dietaryFlags: { isGerdTrigger: true, spiceLevel: 'mild' },
};

const legacyRecipe: SavedRecipe = {
  id: 'fixture-legacy',
  name: 'Legacy Tomato Soup',
  calories: 90,
  proteinGrams: 3,
  carbGrams: 14,
  fatGrams: 2,
};

let root: Root | undefined;
let container: HTMLDivElement | undefined;

function resetStore(recipes: SavedRecipe[], overrides: Partial<typeof DEFAULT_PROFILE> = {}) {
  useMealPlannerStore.setState({
    profile: { ...DEFAULT_PROFILE, ...overrides },
    foodCatalog: [],
    exerciseLogs: [],
    loggedFoods: [],
    hydrationLogs: [],
    savedRecipes: recipes,
    weeklyPlan: {
      startDateKey: '2025-01-06',
      seed: 17,
      slots: [{ day: 1, mealWindow: 'breakfast', foodId: 'fixture-existing-slot', servings: 1 }],
    },
    pantryStock: {},
    calorieAdjustmentPlan: null,
    hasHydrated: false,
  });
}

function renderRecipeBox() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(createElement(RecipeBox)));
  return container;
}

function buttonByText(host: HTMLElement, text: string): HTMLButtonElement {
  const button = [...host.querySelectorAll('button')].find((candidate) => candidate.textContent === text);
  if (!button) throw new Error(`Button not found: ${text}`);
  return button;
}

function changeValue(element: HTMLInputElement | HTMLSelectElement, value: string) {
  act(() => {
    const prototype = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLSelectElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, value);
    element.dispatchEvent(new Event(element instanceof HTMLInputElement ? 'input' : 'change', { bubbles: true }));
  });
}

function click(element: HTMLElement) {
  act(() => element.dispatchEvent(new MouseEvent('click', { bubbles: true })));
}

describe('RecipeBox repairs', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('No image lookup in component fixtures')));
  });

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    root = undefined;
    container = undefined;
    vi.unstubAllGlobals();
  });

  it('replays all known recipe nutrition and metadata, scaling the saved-serving snapshot once', () => {
    resetStore([detailedRecipe], { giConditions: ['acid_reflux_gerd'] });
    const host = renderRecipeBox();

    changeValue(host.querySelector('input[aria-label="Servings to log for Fixture Garden Bowl"]')!, '2');
    click(buttonByText(host, 'Log to Today'));

    const entry = useMealPlannerStore.getState().loggedFoods[0];
    expect(entry).toMatchObject({
      foodId: 'saved-recipe-fixture-detailed',
      name: 'Fixture Garden Bowl',
      calories: 480,
      proteinGrams: 24,
      carbGrams: 60,
      fatGrams: 16,
      mealType: 'dinner',
      portionMode: 'cooked',
      cookingMethod: 'baked',
      servings: 2,
      portion: '1 saved recipe serving',
      imageUrl: 'https://images.unsplash.com/fixture-garden-bowl',
      ingredients: ['quinoa', 'roasted vegetables'],
      dietaryFlags: { isGerdTrigger: true, spiceLevel: 'mild' },
      dietaryVerification: 'verified',
      source: 'saved_recipe',
    });
    expect(entry.dietaryWarnings).toContain('GERD/Sensitive Stomach Trigger');
    expect(host.textContent).toContain('Logged 2 saved servings of Fixture Garden Bowl to today.');
  });

  it('visibly blocks a recipe with a known custom-exclusion conflict and does not log it', () => {
    resetStore([{ ...detailedRecipe, ingredients: ['peanuts', 'quinoa'] }], { customExclusions: ['peanuts'] });
    const host = renderRecipeBox();

    const logButton = buttonByText(host, 'Log to Today');
    expect(logButton.disabled).toBe(true);
    expect(host.textContent).toContain('Blocked: Contains excluded ingredient: peanuts');
    expect(useMealPlannerStore.getState().loggedFoods).toEqual([]);
  });

  it('searches saved recipes and renders legacy detail fallbacks as explicitly unverified', () => {
    resetStore([detailedRecipe, legacyRecipe]);
    const host = renderRecipeBox();

    changeValue(host.querySelector('#recipe-search')!, 'legacy tomato');
    expect(host.textContent).toContain('Legacy Tomato Soup');
    expect(host.textContent).not.toContain('Fixture Garden Bowl');
    expect(host.textContent).toContain('Safety details are unverified');

    click(buttonByText(host, 'View Details'));
    expect(host.textContent).toContain('Serving details unavailable');
    expect(host.textContent).toContain('No ingredient details were saved for this legacy recipe.');
    expect(host.textContent).toContain('No preparation instructions were saved for this legacy recipe.');
  });

  it('adds a custom unpriced recipe item to the selected existing weekly-plan slot and reports the real target date', () => {
    resetStore([detailedRecipe]);
    const host = renderRecipeBox();

    click(buttonByText(host, 'View Details'));
    changeValue(host.querySelector('select[aria-label="Plan day for Fixture Garden Bowl"]')!, '2');
    changeValue(host.querySelector('select[aria-label="Plan meal window for Fixture Garden Bowl"]')!, 'lunch');
    expect(host.textContent).toContain('Target: Lunch on 2025-01-07');

    click(buttonByText(host, 'Add Recipe to Plan'));

    const state = useMealPlannerStore.getState();
    expect(state.weeklyPlan?.slots).toEqual(expect.arrayContaining([
      { day: 1, mealWindow: 'breakfast', foodId: 'fixture-existing-slot', servings: 1 },
      { day: 2, mealWindow: 'lunch', foodId: 'saved-recipe-plan-fixture-detailed-lunch', servings: 1 },
    ]));
    expect(state.foodCatalog).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'saved-recipe-plan-fixture-detailed-lunch',
        ingredients: ['quinoa', 'roasted vegetables'],
        priceAvailability: expect.objectContaining({ walmart: false, kroger: false }),
      }),
    ]));
    expect(host.textContent).toContain('Added Fixture Garden Bowl to lunch on 2025-01-07. Existing weekly-plan slots were kept.');
  });
});
