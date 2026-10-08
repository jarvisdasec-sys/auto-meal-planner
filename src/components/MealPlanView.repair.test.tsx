// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { calculateFoodNutrition } from '@/lib/fitnessMealPlanner';
import { FOOD_CATALOG } from '@/lib/foodCatalog';
import { DEFAULT_PROFILE, useMealPlannerStore } from '@/store/useMealPlannerStore';
import MealPlanView from './MealPlanView';

vi.mock('next/image', () => ({
  default: ({ alt, src }: { alt: string; src: string }) => createElement('img', { alt, src }),
}));

vi.mock('./ScanBarcodeButton', () => ({
  default: () => createElement('button', { type: 'button' }, 'Fixture scanner'),
}));

let root: Root | undefined;
let container: HTMLDivElement | undefined;

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

function renderMealPlan() {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(createElement(MealPlanView)));
  return container;
}

function click(element: Element | undefined) {
  if (!element) throw new Error('Expected an interactive element.');
  act(() => element.dispatchEvent(new MouseEvent('click', { bubbles: true })));
}

function change(element: HTMLSelectElement | HTMLInputElement, value: string) {
  const prototype = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLSelectElement.prototype;
  const nativeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  act(() => {
    if (nativeValueSetter) nativeValueSetter.call(element, value);
    else element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function button(text: string): HTMLButtonElement | undefined {
  return Array.from(container?.querySelectorAll('button') ?? []).find((candidate) => candidate.textContent?.trim() === text) as HTMLButtonElement | undefined;
}

describe('MealPlanView persisted weekly-plan repair', () => {
  beforeEach(() => {
    // React 18 uses this flag to make event and effect assertions deterministic.
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    resetStore();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
  });

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    root = undefined;
    container = undefined;
    vi.unstubAllGlobals();
  });

  it('generates a persisted plan and substitutes a selected plan slot instead of rendering catalog cards', () => {
    renderMealPlan();
    click(button('Generate weekly plan'));
    expect(useMealPlannerStore.getState().weeklyPlan?.slots.length).toBeGreaterThan(0);
    expect(container?.textContent).toContain('planned meal slot');

    act(() => useMealPlannerStore.setState({
      weeklyPlan: {
        startDateKey: '2025-01-06',
        seed: 11,
        slots: [{ day: 1, mealWindow: 'lunch', foodId: 'grilled-chicken', servings: 2 }],
      },
    }));

    expect(Array.from(container?.querySelectorAll('h4') ?? []).map((heading) => heading.textContent)).toEqual(['Grilled Chicken Breast']);
    const replacement = container?.querySelector('#meal-1-lunch-grilled-chicken-replacement') as HTMLSelectElement;
    expect(Array.from(replacement.options).some((option) => option.value === 'turkey-breast')).toBe(true);
    change(replacement, 'turkey-breast');
    click(button('Replace meal'));

    expect(useMealPlannerStore.getState().weeklyPlan?.slots).toContainEqual(
      expect.objectContaining({ day: 1, mealWindow: 'lunch', foodId: 'turkey-breast', servings: 2 }),
    );
    expect(Array.from(container?.querySelectorAll('h4') ?? []).map((heading) => heading.textContent)).toEqual(['Roasted Turkey Breast']);
  });

  it('uses shared raw/cooked/oil nutrition and logs planned meal metadata atomically', () => {
    const tofu = FOOD_CATALOG.find((food) => food.id === 'tofu');
    if (!tofu) throw new Error('Expected tofu fixture in the local seed catalog.');
    useMealPlannerStore.setState({
      weeklyPlan: {
        startDateKey: '2025-01-06',
        seed: 23,
        slots: [{ day: 1, mealWindow: 'lunch', foodId: tofu.id, servings: 2 }],
      },
    });
    renderMealPlan();

    const raw = calculateFoodNutrition(tofu, 'raw', 'pan_fried', { oilType: 'olive_oil', amount: 0, unit: 'tbsp' }, 2);
    expect(container?.textContent).toContain(`${raw.calories} kcal`);

    click(button('Cooked'));
    const cooked = calculateFoodNutrition(tofu, 'cooked', 'pan_fried', { oilType: 'olive_oil', amount: 0, unit: 'tbsp' }, 2);
    expect(container?.textContent).toContain(`${cooked.calories} kcal`);
    expect(cooked.calories).not.toBe(raw.calories);

    const oilInput = container?.querySelector('input[aria-label="Oil amount"]') as HTMLInputElement;
    change(oilInput, '1');
    const oiled = calculateFoodNutrition(tofu, 'cooked', 'pan_fried', { oilType: 'olive_oil', amount: 1, unit: 'tbsp' }, 2);
    expect(container?.textContent).toContain(`${oiled.calories} kcal`);
    click(button('Log Lunch'));

    const entry = useMealPlannerStore.getState().loggedFoods[0];
    expect(entry).toMatchObject({
      foodId: tofu.id,
      mealType: 'lunch',
      portionMode: 'cooked',
      cookingMethod: 'pan_fried',
      servings: 2,
      calories: oiled.calories,
      proteinGrams: oiled.proteinGrams,
      carbGrams: oiled.carbGrams,
      fatGrams: oiled.fatGrams,
      oilAddition: { oilType: 'olive_oil', amount: 1, unit: 'tbsp' },
      dateKey: '2025-01-06',
    });
  });

  it('logs a selected later plan day to that actual local date, not to today', () => {
    useMealPlannerStore.setState({
      weeklyPlan: { startDateKey: '2025-01-06', seed: 23, slots: [
        { day: 3, mealWindow: 'lunch', foodId: 'grilled-chicken', servings: 1 },
      ] },
    });
    renderMealPlan();
    const dayButton = Array.from(container?.querySelectorAll('button') ?? []).find((candidate) => candidate.textContent?.startsWith('Day 3'));
    click(dayButton);
    click(button('Log Lunch'));
    expect(useMealPlannerStore.getState().loggedFoods[0]).toMatchObject({ dateKey: '2025-01-08', source: 'weekly_plan' });
  });
});
