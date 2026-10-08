// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FOOD_CATALOG } from '@/lib/foodCatalog';
import { DEFAULT_PROFILE, useMealPlannerStore } from '@/store/useMealPlannerStore';
import EntryEditor from './EntryEditor';

vi.mock('next/image', () => ({
  default: () => null,
}));

let root: Root | undefined;
let host: HTMLDivElement | undefined;

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

async function mount(ui: React.ReactNode) {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root?.render(ui));
  return host;
}

function setControl(control: HTMLInputElement | HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    control instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLSelectElement.prototype,
    'value',
  )?.set;
  setter?.call(control, value);
  control.dispatchEvent(new Event('input', { bubbles: true }));
  control.dispatchEvent(new Event('change', { bubbles: true }));
}

async function submit(form: HTMLFormElement) {
  await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
}

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  resetStore();
});

afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  root = undefined;
  host = undefined;
});

describe('EntryEditor repairs', () => {
  it('prefills and saves a food nutrition snapshot without changing the entry identity or timestamp', async () => {
    useMealPlannerStore.setState({
      loggedFoods: [{
        id: 'fixture-food',
        foodId: 'manual-fixture',
        name: 'Fixture lunch',
        calories: 320,
        proteinGrams: 21,
        carbGrams: 38,
        fatGrams: 9,
        portionMode: 'raw',
        cookingMethod: 'raw',
        mealType: 'lunch',
        dateKey: '2025-02-03',
        timestamp: '2025-02-03T12:00:00.000Z',
      }],
    });
    const onClose = vi.fn();
    const container = await mount(createElement(EntryEditor, { kind: 'food', id: 'fixture-food', onClose }));

    expect((container.querySelector('#entry-food-name') as HTMLInputElement).value).toBe('Fixture lunch');
    expect((container.querySelector('#entry-food-calories') as HTMLInputElement).value).toBe('320');
    await act(async () => {
      setControl(container.querySelector('#entry-food-name') as HTMLInputElement, 'Corrected lunch');
      setControl(container.querySelector('#entry-food-calories') as HTMLInputElement, '410');
      setControl(container.querySelector('#entry-food-protein') as HTMLInputElement, '31');
      setControl(container.querySelector('#entry-food-carbs') as HTMLInputElement, '42');
      setControl(container.querySelector('#entry-food-fat') as HTMLInputElement, '11');
      setControl(container.querySelector('#entry-food-meal') as HTMLSelectElement, 'dinner');
      setControl(container.querySelector('#entry-food-date') as HTMLInputElement, '2025-02-04');
    });
    await submit(container.querySelector('form')!);

    expect(onClose).toHaveBeenCalledOnce();
    expect(useMealPlannerStore.getState().loggedFoods).toEqual([expect.objectContaining({
      id: 'fixture-food',
      timestamp: '2025-02-03T12:00:00.000Z',
      name: 'Corrected lunch',
      calories: 410,
      proteinGrams: 31,
      carbGrams: 42,
      fatGrams: 11,
      mealType: 'dinner',
      dateKey: '2025-02-04',
    })]);
  });

  it('edits exercise fields and preserves its immutable identity fields', async () => {
    useMealPlannerStore.setState({
      exerciseLogs: [{
        id: 'fixture-exercise',
        activityName: 'Walk',
        durationMinutes: 30,
        caloriesBurned: 120,
        dateKey: '2025-02-03',
        timestamp: '2025-02-03T08:00:00.000Z',
      }],
    });
    const onClose = vi.fn();
    const container = await mount(createElement(EntryEditor, { kind: 'exercise', id: 'fixture-exercise', onClose }));

    await act(async () => {
      setControl(container.querySelector('#entry-exercise-name') as HTMLInputElement, 'Interval run');
      setControl(container.querySelector('#entry-exercise-duration') as HTMLInputElement, '45');
      setControl(container.querySelector('#entry-exercise-burned') as HTMLInputElement, '430');
      setControl(container.querySelector('#entry-exercise-date') as HTMLInputElement, '2025-02-04');
    });
    await submit(container.querySelector('form')!);

    expect(onClose).toHaveBeenCalledOnce();
    expect(useMealPlannerStore.getState().exerciseLogs).toEqual([expect.objectContaining({
      id: 'fixture-exercise',
      timestamp: '2025-02-03T08:00:00.000Z',
      activityName: 'Interval run',
      durationMinutes: 45,
      caloriesBurned: 430,
      dateKey: '2025-02-04',
    })]);
  });

  it('updates hydration date and amount, and keeps invalid hydration input out of the store', async () => {
    useMealPlannerStore.setState({
      hydrationLogs: [{
        id: 'fixture-water',
        ounces: 8,
        dateKey: '2025-02-03',
        timestamp: '2025-02-03T10:00:00.000Z',
      }],
    });
    const onClose = vi.fn();
    const container = await mount(createElement(EntryEditor, { kind: 'hydration', id: 'fixture-water', onClose }));

    await act(async () => {
      setControl(container.querySelector('#entry-hydration-ounces') as HTMLInputElement, '-8');
    });
    await submit(container.querySelector('form')!);
    expect(container.textContent).toContain('Water amount must be greater than zero.');
    expect(useMealPlannerStore.getState().hydrationLogs[0]).toMatchObject({ ounces: 8, dateKey: '2025-02-03' });
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => {
      setControl(container.querySelector('#entry-hydration-ounces') as HTMLInputElement, '20');
      setControl(container.querySelector('#entry-hydration-date') as HTMLInputElement, '2025-02-04');
    });
    await submit(container.querySelector('form')!);

    expect(onClose).toHaveBeenCalledOnce();
    expect(useMealPlannerStore.getState().hydrationLogs).toEqual([expect.objectContaining({
      id: 'fixture-water',
      timestamp: '2025-02-03T10:00:00.000Z',
      ounces: 20,
      dateKey: '2025-02-04',
    })]);
  });
});
