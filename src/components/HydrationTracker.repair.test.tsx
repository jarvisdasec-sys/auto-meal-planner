// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addDays, localDateKey } from '@/lib/dateKeys';
import { FOOD_CATALOG } from '@/lib/foodCatalog';
import { DEFAULT_PROFILE, useMealPlannerStore } from '@/store/useMealPlannerStore';
import HydrationTracker from './HydrationTracker';

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

function setInput(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
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

describe('HydrationTracker repairs', () => {
  it('adds and removes water on the displayed selected local date rather than silently using today', async () => {
    const selectedDate = addDays(localDateKey(), -1);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root?.render(createElement(HydrationTracker)));

    await act(async () => {
      setInput(host!.querySelector('#hydration-date') as HTMLInputElement, selectedDate);
    });
    await act(async () => {
      const button = Array.from(host!.querySelectorAll('button')).find((candidate) => candidate.textContent?.trim() === '+ 8 oz');
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(useMealPlannerStore.getState().hydrationLogs).toEqual([expect.objectContaining({ ounces: 8, dateKey: selectedDate })]);
    expect(host.textContent).toContain('8 oz');

    await act(async () => {
      const remove = Array.from(host!.querySelectorAll('button')).find((candidate) => candidate.textContent === 'Remove');
      remove?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(useMealPlannerStore.getState().hydrationLogs).toEqual([]);
  });
});
