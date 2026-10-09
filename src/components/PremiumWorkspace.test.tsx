// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FOOD_CATALOG } from '@/lib/foodCatalog';
import { DEFAULT_PROFILE, useMealPlannerStore } from '@/store/useMealPlannerStore';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import WeeklyPlanner from './WeeklyPlanner';
import MealPrepHub from './MealPrepHub';
import ShoppingWorkspace from './ShoppingWorkspace';
import WorkspaceSettings from './WorkspaceSettings';

const download = vi.hoisted(() => vi.fn());
vi.mock('@/lib/premiumPlanner', async (original) => ({ ...await original<typeof import('@/lib/premiumPlanner')>(), downloadText: download }));
let root: Root;
let container: HTMLDivElement;
function render(component: React.ReactNode) {
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
  act(() => root.render(component));
}
function click(text: string) {
  const button = [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === text);
  if (!button) throw new Error(`Missing button: ${text}`);
  act(() => button.click());
}
function change(element: HTMLInputElement | HTMLSelectElement, value: string) {
  const proto = element instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLSelectElement.prototype;
  act(() => { Object.getOwnPropertyDescriptor(proto, 'value')?.set?.call(element, value); element.dispatchEvent(new Event('input', { bubbles: true })); element.dispatchEvent(new Event('change', { bubbles: true })); });
}
function seed() {
  useMealPlannerStore.setState({ weeklyPlan: { startDateKey: '2026-10-09', seed: 7, slots: [{ day: 1, mealWindow: 'lunch', foodId: 'grilled-chicken', servings: 2 }, { day: 5, mealWindow: 'dinner', foodId: 'grilled-chicken', servings: 1 }] } });
}

describe('BTB premium workspaces', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    useMealPlannerStore.setState({ profile: DEFAULT_PROFILE, foodCatalog: FOOD_CATALOG, weeklyPlan: null, pantryStock: {}, loggedFoods: [], savedRecipes: [], hydrationLogs: [], exerciseLogs: [], calorieAdjustmentPlan: null });
    useWorkspaceStore.setState({ householdSize: 1, weeklyBudget: 100, prepSessions: {}, purchased: {} });
    download.mockClear();
  });
  afterEach(() => { act(() => root?.unmount()); container?.remove(); vi.restoreAllMocks(); });
  it('generates a real seven-day plan, adjusts servings, and exports it', () => {
    render(createElement(WeeklyPlanner, { onOpenDaily: vi.fn(), onOpenPrep: vi.fn() }));
    click('Generate my week');
    expect(useMealPlannerStore.getState().weeklyPlan?.slots).toHaveLength(28);
    const servings = container.querySelector('input[aria-label="Servings for Day 1 Breakfast"]') as HTMLInputElement;
    change(servings, '2');
    expect(useMealPlannerStore.getState().weeklyPlan?.slots.find((s) => s.day === 1 && s.mealWindow === 'breakfast')?.servings).toBe(2);
    click('Export CSV');
    expect(download).toHaveBeenCalledWith('BTB-weekly-plan.csv', expect.stringContaining('Personal servings'));
  });
  it('copies only the requested day while leaving logs and other days intact', () => {
    seed(); const before = useMealPlannerStore.getState().weeklyPlan!;
    useMealPlannerStore.getState().copyWeeklyPlanDay(1, 2);
    expect(useMealPlannerStore.getState().weeklyPlan?.slots).toContainEqual({ day: 2, mealWindow: 'lunch', foodId: 'grilled-chicken', servings: 2 });
    expect(useMealPlannerStore.getState().weeklyPlan?.slots.filter((s) => s.day === 5)).toEqual(before.slots.filter((s) => s.day === 5));
    expect(() => useMealPlannerStore.getState().copyWeeklyPlanDay(1, 1)).toThrow('different');
    expect(useMealPlannerStore.getState().loggedFoods).toEqual([]);
  });
  it('creates a household-scaled prep list and stores plan-specific completion', () => {
    seed(); useWorkspaceStore.setState({ householdSize: 2 });
    render(createElement(MealPrepHub, { onOpenPlan: vi.fn(), onOpenShopping: vi.fn() }));
    expect(container.textContent).toContain('6 portions');
    const checkbox = container.querySelector('input[aria-label="Mark Grilled Chicken Breast as prepared"]') as HTMLInputElement;
    act(() => checkbox.click());
    expect(Object.values(useWorkspaceStore.getState().prepSessions)[0].completed).toContain('food:grilled-chicken');
    act(() => useMealPlannerStore.getState().substituteWeeklyPlanSlot(1, 'lunch', 'grilled-chicken', 3));
    expect((container.querySelector('input[aria-label="Mark Grilled Chicken Breast as prepared"]') as HTMLInputElement).checked).toBe(false);
  });
  it('subtracts pantry after scaling and persists checkmarks without creating stock', () => {
    seed(); useWorkspaceStore.setState({ householdSize: 2 }); useMealPlannerStore.setState({ pantryStock: { 'grilled-chicken': { portions: 1 } } });
    render(createElement(ShoppingWorkspace, { onOpenPantry: vi.fn(), onOpenPlan: vi.fn() }));
    expect(container.textContent).toContain('Buy 5 portions');
    const checkbox = container.querySelector('#shopping-purchased-grilled-chicken') as HTMLInputElement;
    act(() => checkbox.click());
    expect(Object.values(useWorkspaceStore.getState().purchased)[0]).toContain('grilled-chicken');
    expect(useMealPlannerStore.getState().pantryStock['grilled-chicken'].portions).toBe(1);
    act(() => useWorkspaceStore.getState().updatePreferences(3, 100));
    expect((container.querySelector('#shopping-purchased-grilled-chicken') as HTMLInputElement).checked).toBe(false);
  });
  it('exports whitelisted data and no state functions in browser backup', () => {
    seed(); render(createElement(WorkspaceSettings)); click('Download browser backup (JSON)');
    const payload = JSON.parse(download.mock.calls[0][1]);
    expect(payload.primaryStore.weeklyPlan.slots).toHaveLength(2);
    expect(payload.primaryStore.profile).toEqual(DEFAULT_PROFILE);
    expect(payload.primaryStore.logFood).toBeUndefined();
    expect(payload.workspace.householdSize).toBe(1);
  });
});
