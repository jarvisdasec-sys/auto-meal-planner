// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  logFood: vi.fn(),
  addSavedRecipe: vi.fn(),
  profile: {
    fullName: 'Fixture', heightCm: 175, currentWeightKg: 70, age: 30, gender: 'female', activityLevel: 1.55,
    goal: 'maintenance', snackCravings: [], dietaryRestrictions: [], preferredStore: 'walmart', majorAllergens: [],
    giConditions: [], spiceLevel: 'medium', customExclusions: [],
  },
}));

vi.mock('@/store/useMealPlannerStore', () => ({
  useMealPlannerStore: (selector: (state: typeof mocks) => unknown) => selector(mocks),
}));
vi.mock('@/data/nutritionDatabase', () => ({
  NUTRITION_DATABASE: [{
    id: 'fixture-food', name: 'Fixture Food', category: 'snacks', isSupplement: false,
    servingSize: { amount: 30, unit: 'g' }, calories: 100, proteinGrams: 10, carbGrams: 12, fatGrams: 2,
    dietaryTags: [],
  }],
}));
vi.mock('next/image', () => ({ default: () => null }));
vi.mock('./FoodImage', () => ({ default: () => null }));

import FoodLogger from './FoodLogger';
import LogFoodModal, { type LogFoodInput } from './LogFoodModal';
import CustomFoodModal from './CustomFoodModal';
import EatingOutModal from './EatingOutModal';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function render(node: React.ReactNode) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => { root!.render(node); });
  return container;
}

async function setValue(input: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
  setter?.call(input, value);
  await act(async () => { input.dispatchEvent(new Event('input', { bubbles: true })); });
}

async function click(element: Element) {
  await act(async () => { element.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
}

afterEach(async () => {
  await act(async () => { root?.unmount(); });
  container?.remove(); root = null; container = null;
  mocks.logFood.mockReset(); mocks.addSavedRecipe.mockReset();
  window.localStorage.clear();
});

describe('Food Logger repairs', () => {
  it('sends a fractional listed-serving multiplier and per-serving macro metadata once', async () => {
    const view = await render(createElement(FoodLogger));
    await setValue(view.querySelector('#servings-fixture-food') as HTMLInputElement, '1.5');
    await click([...view.querySelectorAll('button')].find((button) => button.textContent === 'Log')!);

    expect(mocks.logFood).toHaveBeenCalledWith(
      expect.stringMatching(/^nutrition-fixture-food-/), 'Fixture Food', 100, 'raw', 'raw', undefined, 'breakfast',
      { proteinGrams: 10, carbGrams: 12, fatGrams: 2 },
      expect.objectContaining({ servings: 1.5, nutritionIsPerServing: true, portion: '1.5 × 30 g', source: 'nutrition_database' }),
    );
  });

  it('scales manual inputs while accepting zero calories and blocks blank, negative, and zero-serving values', async () => {
    const save = vi.fn<(input: LogFoodInput) => void>();
    let view = await render(createElement(LogFoodModal, { open: true, onClose: vi.fn(), onSave: save }));
    await setValue(view.querySelector('#manual-food-name') as HTMLInputElement, 'Zero kcal tea');
    await setValue(view.querySelector('#manual-food-calories') as HTMLInputElement, '0');
    await setValue(view.querySelector('#manual-food-protein') as HTMLInputElement, '2');
    await setValue(view.querySelector('#manual-food-servings') as HTMLInputElement, '2');
    await act(async () => { (view.querySelector('form') as HTMLFormElement).requestSubmit(); });
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ calories: 0, proteinGrams: 4, servings: 2 }));

    await act(async () => { root!.render(createElement(LogFoodModal, { open: true, onClose: vi.fn(), onSave: save })); });
    view = container!;
    await setValue(view.querySelector('#manual-food-name') as HTMLInputElement, 'Bad entry');
    await setValue(view.querySelector('#manual-food-calories') as HTMLInputElement, '-2');
    await act(async () => { (view.querySelector('form') as HTMLFormElement).requestSubmit(); });
    expect(save).toHaveBeenCalledTimes(1);
    expect(view.querySelector('[role="alert"]')?.textContent).toContain('zero or greater');

    await setValue(view.querySelector('#manual-food-calories') as HTMLInputElement, '10');
    await setValue(view.querySelector('#manual-food-servings') as HTMLInputElement, '0');
    await act(async () => { (view.querySelector('form') as HTMLFormElement).requestSubmit(); });
    expect(save).toHaveBeenCalledTimes(1);
    expect(view.querySelector('[role="alert"]')?.textContent).toContain('greater than zero');
  });

  it('accepts a zero-calorie custom entry but rejects a negative value before invoking its callback', async () => {
    const save = vi.fn();
    const view = await render(createElement(CustomFoodModal, { open: true, onClose: vi.fn(), onSave: save }));
    await setValue(view.querySelector('#custom-food-name') as HTMLInputElement, 'Zero soda');
    await setValue(view.querySelector('#custom-food-calories') as HTMLInputElement, '0');
    await act(async () => { (view.querySelector('form') as HTMLFormElement).requestSubmit(); });
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ calories: 0, servings: 1, nutritionIsPerServing: true }));

    await act(async () => { root!.render(createElement(CustomFoodModal, { open: true, onClose: vi.fn(), onSave: save })); });
    await setValue(container!.querySelector('#custom-food-name') as HTMLInputElement, 'Bad custom');
    await setValue(container!.querySelector('#custom-food-calories') as HTMLInputElement, '-1');
    await act(async () => { (container!.querySelector('form') as HTMLFormElement).requestSubmit(); });
    expect(save).toHaveBeenCalledTimes(1);
    expect(container!.querySelector('[role="alert"]')?.textContent).toContain('zero or greater');
  });

  it('shows useful custom-image feedback and does not save an unallowlisted URL', async () => {
    const view = await render(createElement(FoodLogger));
    await click([...view.querySelectorAll('button')].find((button) => button.textContent === '+ Custom Food')!);
    await setValue(view.querySelector('#builder-name') as HTMLInputElement, 'Local fixture');
    await setValue(view.querySelector('#builder-calories') as HTMLInputElement, '0');
    await setValue(view.querySelector('#builder-image') as HTMLInputElement, 'https://untrusted.example/photo.jpg');
    await act(async () => { (view.querySelector('form') as HTMLFormElement).requestSubmit(); });
    expect(view.querySelector('[role="alert"]')?.textContent).toContain('supported HTTPS image host');
    expect(mocks.addSavedRecipe).not.toHaveBeenCalled();
  });

  it('keeps restaurant macro menu data and passes a dated adjustment through its callback', async () => {
    const onLogMeal = vi.fn();
    const view = await render(createElement(EatingOutModal, { open: true, onClose: vi.fn(), remainingCalories: 100, onLogMeal }));
    await click([...view.querySelectorAll('button')].find((button) => button.textContent === 'Log This Meal')!);
    const [item, plan] = onLogMeal.mock.calls[0];
    expect(item).toEqual(expect.objectContaining({ calories: expect.any(Number), proteinGrams: expect.any(Number), carbGrams: expect.any(Number), fatGrams: expect.any(Number) }));
    expect(plan).toEqual(expect.objectContaining({ startDateKey: expect.any(String), endDateKey: expect.any(String), daysToSpread: 3 }));
  });
});
