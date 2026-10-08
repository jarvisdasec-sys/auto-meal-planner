// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addDays, localDateKey } from '@/lib/dateKeys';
import { calculateMetabolicSummary } from '@/lib/fitnessMealPlanner';
import { FOOD_CATALOG } from '@/lib/foodCatalog';
import { DEFAULT_PROFILE, useMealPlannerStore } from '@/store/useMealPlannerStore';
import EnergyTracker from './EnergyTracker';

vi.mock('next/image', () => ({
  default: () => null,
}));
vi.mock('./ScanBarcodeButton', () => ({ default: () => createElement('button', { type: 'button' }, 'Scan Barcode') }));
vi.mock('./CookingMethodControls', () => ({ default: () => createElement('div', { 'data-testid': 'cooking-controls' }) }));

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

async function mount() {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root?.render(createElement(EnergyTracker)));
  return host;
}

function setInput(input: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function statValue(container: HTMLElement, label: string) {
  const labelNode = Array.from(container.querySelectorAll('div')).find((node) => node.textContent === label);
  return labelNode?.parentElement?.firstElementChild?.textContent;
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

describe('EnergyTracker repairs', () => {
  it('uses one selected local date for daily totals, macros, and both visible entry lists', async () => {
    const today = localDateKey();
    const yesterday = addDays(today, -1);
    useMealPlannerStore.setState({
      loggedFoods: [
        {
          id: 'fixture-today-food', foodId: 'manual-today', name: 'Today fixture meal', calories: 410,
          proteinGrams: 31, carbGrams: 42, fatGrams: 11, portionMode: 'raw', cookingMethod: 'raw',
          dateKey: today, timestamp: '2025-02-03T12:00:00.000Z', source: 'manual',
        },
        {
          id: 'fixture-yesterday-food', foodId: 'manual-yesterday', name: 'Yesterday fixture meal', calories: 900,
          proteinGrams: 90, carbGrams: 90, fatGrams: 90, portionMode: 'raw', cookingMethod: 'raw',
          dateKey: yesterday, timestamp: '2025-02-02T12:00:00.000Z', source: 'manual',
        },
      ],
      exerciseLogs: [
        { id: 'fixture-today-exercise', activityName: 'Today walk', durationMinutes: 30, caloriesBurned: 150, dateKey: today, timestamp: '2025-02-03T08:00:00.000Z' },
        { id: 'fixture-yesterday-exercise', activityName: 'Yesterday run', durationMinutes: 45, caloriesBurned: 400, dateKey: yesterday, timestamp: '2025-02-02T08:00:00.000Z' },
      ],
    });
    const container = await mount();

    expect(statValue(container, 'Consumed')).toBe('410');
    expect(statValue(container, 'Exercise Burned')).toBe('150');
    expect(statValue(container, 'Protein')).toBe('31g');
    expect(statValue(container, 'Carbs')).toBe('42g');
    expect(statValue(container, 'Fat')).toBe('11g');
    expect(container.textContent).toContain('Today fixture meal');
    expect(container.textContent).toContain('Today walk');
    expect(container.textContent).not.toContain('Yesterday fixture meal');
    expect(container.textContent).not.toContain('Yesterday run');
  });

  it('uses only the dated restaurant adjustment for the selected tracker date', async () => {
    const today = localDateKey();
    const tomorrow = addDays(today, 1);
    useMealPlannerStore.setState({
      calorieAdjustmentPlan: {
        excessCalories: 300,
        daysToSpread: 3,
        dailyOffset: 100,
        startDateKey: tomorrow,
        endDateKey: addDays(tomorrow, 2),
        createdAt: '2025-02-03T18:00:00.000Z',
      },
    });
    const container = await mount();
    const baseTarget = Math.round(calculateMetabolicSummary(DEFAULT_PROFILE).targetCalories);

    expect(statValue(container, 'Target Goal')).toBe(String(baseTarget));
    expect(container.textContent).toContain(`${today}: no adjustment`);
    expect(container.textContent).toContain(`scheduled ${tomorrow} through ${addDays(tomorrow, 2)}`);

    await act(async () => setInput(container.querySelector('#tracker-date') as HTMLInputElement, tomorrow));
    expect(statValue(container, 'Target Goal')).toBe(String(baseTarget - 100));
    expect(container.textContent).toContain(`${tomorrow}: -100 kcal`);
  });

  it('rejects invalid exercise input with actionable feedback and no state mutation', async () => {
    const container = await mount();
    await act(async () => {
      setInput(container.querySelector('#exercise-name') as HTMLInputElement, 'Fixture run');
      setInput(container.querySelector('#exercise-duration') as HTMLInputElement, '-5');
      setInput(container.querySelector('#exercise-burned') as HTMLInputElement, '250');
    });
    await act(async () => {
      const form = (container.querySelector('#exercise-name') as HTMLInputElement).closest('form')!;
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });

    expect(container.textContent).toContain('Exercise duration must be greater than zero.');
    expect(useMealPlannerStore.getState().exerciseLogs).toEqual([]);
  });
});
