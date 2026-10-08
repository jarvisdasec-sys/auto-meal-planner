// @vitest-environment happy-dom
import { act, createElement, type ImgHTMLAttributes } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CatalogFoodItem } from '@/lib/foodCatalog';
import type { EstimatedPrices, UserProfile } from '@/lib/fitnessMealPlanner';
import { STORE_NAMES } from '@/lib/stores';
import { DEFAULT_PROFILE, useMealPlannerStore } from '@/store/useMealPlannerStore';
import GroceryEstimator from './GroceryEstimator';

vi.mock('next/image', () => ({
  default: (props: ImgHTMLAttributes<HTMLImageElement>) => createElement('img', { ...props, alt: props.alt ?? '' }),
}));

const prices = (walmart: number): EstimatedPrices => Object.fromEntries(
  STORE_NAMES.map((store) => [store, store === 'kroger' ? walmart + 1 : walmart]),
) as EstimatedPrices;

const unavailablePrices = (): EstimatedPrices => Object.fromEntries(
  STORE_NAMES.map((store) => [store, 0]),
) as EstimatedPrices;

function food(overrides: Partial<CatalogFoodItem> & Pick<CatalogFoodItem, 'id' | 'name' | 'mealWindows'>): CatalogFoodItem {
  const { id, name, mealWindows, ...rest } = overrides;
  return {
    id,
    barcode: `barcode-${id}`,
    name,
    category: 'protein',
    portionRaw: '170g raw',
    portionCooked: '130g cooked',
    caloriesRaw: 200,
    caloriesCooked: 220,
    proteinGrams: 30,
    carbGrams: 0,
    fatGrams: 5,
    snackProfile: [],
    estimatedPrices: prices(5),
    cookingOptions: [{
      method: 'baked',
      prepTimeMinutes: 5,
      cookTimeMinutes: 15,
      macroMultiplier: { calories: 1, protein: 1, carbs: 1, fat: 1 },
    }],
    dietaryTags: {
      allergens: [],
      isHighFodmap: false,
      isGerdTrigger: false,
      containsGluten: false,
      containsLactose: false,
      spiceLevel: 'none',
    },
    mealWindows,
    ...rest,
  };
}

let root: Root | undefined;
let container: HTMLDivElement | undefined;

function bodyText(): string {
  return document.body.textContent ?? '';
}

function buttonByText(text: string): HTMLButtonElement {
  const button = Array.from(document.querySelectorAll('button')).find((item) => item.textContent?.trim() === text);
  if (!button) throw new Error(`Button not found: ${text}`);
  return button;
}

describe('GroceryEstimator repaired active-plan grocery flow', () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    document.body.innerHTML = '';
    const safeChicken = food({ id: 'safe-chicken', name: 'Safe Chicken', mealWindows: ['lunch', 'dinner'] });
    const unavailableFood = food({
      id: 'unknown-veg',
      name: 'Unknown Vegetable',
      category: 'vegetable',
      mealWindows: ['dinner'],
      estimatedPrices: unavailablePrices(),
    });
    const excludedWheat = food({
      id: 'excluded-wheat',
      name: 'Excluded Wheat',
      category: 'carb',
      mealWindows: ['lunch'],
      dietaryTags: {
        allergens: ['wheat'],
        isHighFodmap: false,
        isGerdTrigger: false,
        containsGluten: true,
        containsLactose: false,
        spiceLevel: 'none',
      },
    });
    const profile: UserProfile = {
      ...DEFAULT_PROFILE,
      preferredStore: 'walmart',
      snackCravings: [],
      majorAllergens: ['wheat'],
    };

    useMealPlannerStore.setState({
      profile,
      foodCatalog: [safeChicken, unavailableFood, excludedWheat],
      weeklyPlan: {
        startDateKey: '2025-01-05',
        seed: 11,
        slots: [
          // The active-plan selector must replace this hard-blocked item with Safe Chicken.
          { day: 1, mealWindow: 'lunch', foodId: 'excluded-wheat', servings: 1 },
          { day: 2, mealWindow: 'lunch', foodId: 'safe-chicken', servings: 2 },
          { day: 3, mealWindow: 'dinner', foodId: 'unknown-veg', servings: 1 },
        ],
      },
      pantryStock: { 'safe-chicken': { portions: 1 } },
      exerciseLogs: [],
      loggedFoods: [],
      hydrationLogs: [],
      savedRecipes: [],
      calorieAdjustmentPlan: null,
      hasHydrated: false,
    });

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root?.render(createElement(GroceryEstimator)));
  });

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    root = undefined;
    container = undefined;
  });

  it('uses dietary-safe active slots, actual summed servings, pantry subtraction, and matching partial totals when the store changes', () => {
    // One excluded lunch is resolved to Safe Chicken, then combines with its two-serving lunch.
    expect(bodyText()).toContain('Safe Chicken');
    expect(bodyText()).not.toContain('Excluded Wheat');
    expect(bodyText()).toContain('Planned: 3 portions · On hand: 1 portion · To buy: 2 portions');
    expect(bodyText()).not.toContain('7 portions');

    const walmartHeading = Array.from(document.querySelectorAll('h3')).find((heading) => heading.textContent === 'Walmart — Your Preferred Store');
    expect(walmartHeading?.parentElement?.textContent).toContain('$10.00');
    expect(walmartHeading?.parentElement?.textContent).toContain('Known estimated subtotal (partial)');
    expect(bodyText()).toContain('1 item price unavailable');

    act(() => buttonByText('Generate Grocery List').click());
    const modalList = document.querySelector('.print-area');
    expect(modalList?.textContent).toContain('Planned: 3 portions · On hand: 1 portion · To buy: 2 portions');
    expect(modalList?.textContent).toContain('Price unavailable');
    expect(modalList?.textContent).toContain('Known subtotal (partial)');
    expect(modalList?.textContent).toContain('$10.00');

    const storeSelect = document.querySelector<HTMLSelectElement>('#grocery-store');
    if (!storeSelect) throw new Error('Store select not found');
    act(() => {
      storeSelect.value = 'kroger';
      storeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    });

    const krogerHeading = Array.from(document.querySelectorAll('h3')).find((heading) => heading.textContent === 'Kroger — Your Preferred Store');
    expect(krogerHeading?.parentElement?.textContent).toContain('$12.00');
    expect(document.querySelector('.print-area')?.textContent).toContain('$12.00');
    expect(document.querySelector('.print-area')?.textContent).toContain('Known subtotal (partial)');
  });
});
