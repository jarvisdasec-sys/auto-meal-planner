// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CatalogFoodItem } from '@/lib/foodCatalog';
import type { UserProfile } from '@/lib/fitnessMealPlanner';
import { getPortionGuideForFood } from '@/lib/portionGuides';
import type { PersistedWeeklyPlan } from '@/lib/weeklyPlan';
import type { LoggedFoodEntry, MealPlannerState } from '@/store/useMealPlannerStore';
import { useMealPlannerStore } from '@/store/useMealPlannerStore';
import PortionGallery from './PortionGallery';

vi.mock('next/image', () => ({
  default: ({ src, alt, className }: { src?: string; alt?: string; className?: string }) => (
    createElement('img', { src, alt, className })
  ),
}));

const localProfile: UserProfile = {
  fullName: 'Fixture User',
  heightCm: 170,
  currentWeightKg: 70,
  age: 30,
  gender: 'female',
  activityLevel: 1.55,
  goal: 'maintenance',
  snackCravings: ['savory'],
  dietaryRestrictions: [],
  preferredStore: 'walmart',
  majorAllergens: ['wheat'],
  giConditions: [],
  spiceLevel: 'medium',
  customExclusions: [],
};

function fixtureFood(overrides: Partial<CatalogFoodItem> = {}): CatalogFoodItem {
  return {
    id: 'fixture-protein',
    barcode: '123456789012',
    name: 'Fixture Protein',
    category: 'protein',
    portionRaw: '100 g raw',
    caloriesRaw: 100,
    portionCooked: '80 g cooked',
    caloriesCooked: 120,
    proteinGrams: 20,
    carbGrams: 4,
    fatGrams: 3,
    snackProfile: ['savory'],
    estimatedPrices: {} as CatalogFoodItem['estimatedPrices'],
    imageUrl: '/images/fixture-food.png',
    cookingOptions: [{
      method: 'raw',
      prepTimeMinutes: 0,
      cookTimeMinutes: 0,
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
    mealWindows: ['lunch'],
    ...overrides,
  };
}

let root: Root | undefined;
let container: HTMLDivElement | undefined;
const initialState = useMealPlannerStore.getState();

function setGalleryFixtures({
  catalog,
  loggedFoods = [],
  weeklyPlan = null,
}: {
  catalog: CatalogFoodItem[];
  loggedFoods?: LoggedFoodEntry[];
  weeklyPlan?: PersistedWeeklyPlan | null;
}) {
  useMealPlannerStore.setState({
    profile: localProfile,
    foodCatalog: catalog,
    loggedFoods,
    weeklyPlan,
    hasHydrated: false,
  });
}

function renderGallery(): HTMLDivElement {
  container = document.createElement('div');
  document.body.appendChild(container);
  act(() => {
    root = createRoot(container!);
    root.render(createElement(PortionGallery));
  });
  return container;
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  setGalleryFixtures({ catalog: [] });
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = undefined;
  container = undefined;
  useMealPlannerStore.setState(initialState as MealPlannerState, true);
});

describe('PortionGallery repair coverage', () => {
  it('removes allergy-blocked foods from profile-filtered recommendations but retains allowed foods', () => {
    const allowed = fixtureFood({ id: 'allowed-lunch', name: 'Allowed Lunch' });
    const blocked = fixtureFood({
      id: 'blocked-lunch',
      name: 'Blocked Wheat Lunch',
      dietaryTags: {
        ...allowed.dietaryTags,
        allergens: ['wheat'],
        containsGluten: true,
      },
    });
    setGalleryFixtures({ catalog: [allowed, blocked] });

    const view = renderGallery();

    expect(view.textContent).toContain('Allowed Lunch');
    expect(view.textContent).not.toContain('Blocked Wheat Lunch');
  });

  it('uses the active weekly plan rather than showing otherwise eligible off-plan cards', () => {
    const planned = fixtureFood({ id: 'planned-lunch', name: 'Planned Lunch' });
    const offPlan = fixtureFood({ id: 'off-plan-lunch', name: 'Off-plan Lunch' });
    setGalleryFixtures({
      catalog: [planned, offPlan],
      weeklyPlan: {
        startDateKey: '2025-02-03',
        seed: 10,
        slots: [{ day: 1, mealWindow: 'lunch', foodId: planned.id, servings: 1 }],
      },
    });

    const view = renderGallery();

    expect(view.textContent).toContain('Planned Lunch');
    expect(view.textContent).not.toContain('Off-plan Lunch');
    expect(view.textContent).toContain('From your active weekly plan');
  });

  it('maps protein, fat, carbohydrate, and concentrated-fat foods to accurate reachable hand guides', () => {
    expect(getPortionGuideForFood({ id: 'greek-yogurt', category: 'snack' })?.guide).toBe('palm');
    expect(getPortionGuideForFood({ id: 'jerky', category: 'snack' })?.guide).toBe('palm');
    expect(getPortionGuideForFood({ id: 'trail-mix', category: 'snack' })?.guide).toBe('thumb');
    expect(getPortionGuideForFood({ name: 'Mixed Nuts', category: 'snack' })?.guide).toBe('thumb');
    expect(getPortionGuideForFood({ id: 'rice-cakes', category: 'snack' })?.guide).toBe('cupped_hand');
    expect(getPortionGuideForFood({ name: 'Olive Oil Drizzle', category: 'fat' })?.guide).toBe('thumb_tip');

    const oil = fixtureFood({
      id: 'olive-oil-fixture',
      name: 'Olive Oil Drizzle',
      category: 'fat',
      mealWindows: ['snacks'],
    });
    setGalleryFixtures({ catalog: [oil] });
    const view = renderGallery();
    const guide = view.querySelector('[aria-label="Approximate hand guide for Olive Oil Drizzle"]');

    expect(guide?.textContent).toContain('Thumb Tip');
    expect(guide?.textContent).toContain('Measure: about 1 tsp');
    expect(guide?.textContent).toContain('concentrated fats such as butter, dressings, and cooking oil');
    expect(view.querySelector('[aria-label="Approximate hand-guide legend"]')?.textContent).toContain('Thumb Tip');
  });

  it('renders persisted logged calories and macros rather than replacing them with catalog values', () => {
    const catalogFood = fixtureFood({
      id: 'saved-snapshot-food',
      name: 'Saved Snapshot Food',
      proteinGrams: 2,
      carbGrams: 3,
      fatGrams: 4,
    });
    const loggedFood: LoggedFoodEntry = {
      id: 'saved-log',
      foodId: catalogFood.id,
      name: catalogFood.name,
      calories: 333,
      proteinGrams: 33,
      carbGrams: 11,
      fatGrams: 22,
      portionMode: 'cooked',
      portion: '175 g cooked, measured at logging',
      cookingMethod: 'raw',
      dateKey: '2024-12-01',
      timestamp: '2024-12-01T12:00:00.000Z',
      imageUrl: '/images/saved-fixture-food.png',
    };
    setGalleryFixtures({ catalog: [catalogFood], loggedFoods: [loggedFood] });

    const view = renderGallery();
    const savedLogsTitle = Array.from(view.querySelectorAll('h3')).find((heading) => heading.textContent === 'Saved Food Logs');
    const savedLogsCard = savedLogsTitle?.parentElement;

    expect(view.textContent).toContain('Saved Food Logs');
    expect(savedLogsCard?.textContent).toContain('333 kcal');
    expect(savedLogsCard?.textContent).toContain('P33 · C11 · F22');
    expect(savedLogsCard?.textContent).toContain('Measured cooked portion: 175 g cooked, measured at logging');
    expect(savedLogsCard?.textContent).not.toContain('P2 · C3 · F4');
  });
});
