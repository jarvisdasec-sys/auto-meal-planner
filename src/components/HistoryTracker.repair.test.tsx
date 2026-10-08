// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExerciseLog } from '@/lib/fitnessMealPlanner';
import type { HydrationEntry, LoggedFoodEntry } from '@/store/useMealPlannerStore';
import { useMealPlannerStore } from '@/store/useMealPlannerStore';

vi.mock('@/components/EntryEditor', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  return {
    default: ({ kind, id, onClose }: { kind: string; id: string; onClose: () => void }) =>
      React.createElement(
        'div',
        { 'data-testid': 'entry-editor', 'data-kind': kind, 'data-id': id },
        React.createElement('button', { type: 'button', onClick: onClose }, 'Close editor'),
      ),
  };
});

import HistoryTracker from './HistoryTracker';

function localTimestamp(year: number, monthIndex: number, day: number, hour: number, minute: number): string {
  return new Date(year, monthIndex, day, hour, minute).toISOString();
}

function changeDate(input: HTMLInputElement, value: string): void {
  const nativeValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  nativeValueSetter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('HistoryTracker repair', () => {
  let container: HTMLDivElement;
  let root: Root;
  const original = useMealPlannerStore.getState();

  const targetFood: LoggedFoodEntry = {
    id: 'target-food',
    foodId: 'manual-target-food',
    name: 'Manual tofu bowl',
    calories: 410,
    proteinGrams: 23,
    carbGrams: 34,
    fatGrams: 12,
    portionMode: 'cooked',
    cookingMethod: 'steamed',
    mealType: 'lunch',
    dateKey: '2025-01-10',
    timestamp: '2025-01-10T18:00:00.000Z',
  };

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    const lateLocalFood: LoggedFoodEntry = {
      id: 'legacy-late-food',
      foodId: 'manual-legacy-food',
      name: 'Legacy late snack',
      calories: 90,
      proteinGrams: 7,
      carbGrams: 8,
      fatGrams: 2,
      portionMode: 'raw',
      cookingMethod: 'raw',
      timestamp: localTimestamp(2025, 0, 10, 23, 50),
    };
    const afterMidnightFood: LoggedFoodEntry = {
      id: 'legacy-next-day-food',
      foodId: 'manual-next-day-food',
      name: 'After midnight snack',
      calories: 120,
      proteinGrams: 4,
      carbGrams: 18,
      fatGrams: 3,
      portionMode: 'raw',
      cookingMethod: 'raw',
      timestamp: localTimestamp(2025, 0, 11, 0, 10),
    };
    const olderFood: LoggedFoodEntry = {
      ...targetFood,
      id: 'older-food',
      name: 'Older meal',
      dateKey: '2025-01-09',
      calories: 999,
      proteinGrams: 99,
      timestamp: '2025-01-09T18:00:00.000Z',
    };
    const exerciseLogs: ExerciseLog[] = [
      { id: 'target-workout', activityName: 'Target walk', durationMinutes: 30, caloriesBurned: 250, dateKey: '2025-01-10', timestamp: '2025-01-10T18:30:00.000Z' },
      { id: 'older-workout', activityName: 'Older run', durationMinutes: 45, caloriesBurned: 800, dateKey: '2025-01-09', timestamp: '2025-01-09T18:30:00.000Z' },
    ];
    const hydrationLogs: HydrationEntry[] = [
      { id: 'target-water', ounces: 16, dateKey: '2025-01-10', timestamp: '2025-01-10T18:45:00.000Z' },
    ];

    useMealPlannerStore.setState({
      foodCatalog: [],
      loggedFoods: [olderFood, targetFood, lateLocalFood, afterMidnightFood],
      exerciseLogs,
      hydrationLogs,
    });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    useMealPlannerStore.setState({
      foodCatalog: original.foodCatalog,
      loggedFoods: original.loggedFoods,
      exerciseLogs: original.exerciseLogs,
      hydrationLogs: original.hydrationLogs,
    });
  });

  it('keeps legacy local-midnight entries on their local selected day and uses persisted manual macros', async () => {
    await act(async () => root.render(createElement(HistoryTracker)));
    const dateInput = container.querySelector<HTMLInputElement>('#history-date');
    expect(dateInput).not.toBeNull();

    await act(async () => changeDate(dateInput!, '2025-01-10'));

    expect(container.textContent).toContain('Manual tofu bowl');
    expect(container.textContent).toContain('Legacy late snack');
    expect(container.textContent).not.toContain('After midnight snack');
    expect(container.textContent).not.toContain('Older meal');
    expect(container.textContent).toContain('30 g');
    expect(container.textContent).toContain('500 kcal');
    expect(container.textContent).toContain('250 kcal');

    await act(async () => changeDate(dateInput!, '2025-01-11'));
    expect(container.textContent).toContain('After midnight snack');
    expect(container.textContent).not.toContain('Legacy late snack');
  });

  it('opens the shared editor for a selected entry and removes only that entry', async () => {
    await act(async () => root.render(createElement(HistoryTracker)));
    const dateInput = container.querySelector<HTMLInputElement>('#history-date');
    await act(async () => changeDate(dateInput!, '2025-01-10'));

    const edit = container.querySelector<HTMLButtonElement>('[aria-label="Edit logged meal Manual tofu bowl"]');
    expect(edit).not.toBeNull();
    await act(async () => edit!.click());
    const editor = container.querySelector<HTMLElement>('[data-testid="entry-editor"]');
    expect(editor?.dataset.kind).toBe('food');
    expect(editor?.dataset.id).toBe('target-food');

    const remove = container.querySelector<HTMLButtonElement>('[aria-label="Remove logged meal Manual tofu bowl"]');
    expect(remove).not.toBeNull();
    await act(async () => remove!.click());

    expect(container.querySelector('[aria-label="Remove logged meal Manual tofu bowl"]')).toBeNull();
    expect(container.textContent).toContain('Removed Manual tofu bowl from 2025-01-10.');
    expect(useMealPlannerStore.getState().loggedFoods.some((entry) => entry.id === 'target-food')).toBe(false);
    expect(useMealPlannerStore.getState().loggedFoods.some((entry) => entry.id === 'older-food')).toBe(true);
  });
});
