// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PROFILE, useMealPlannerStore } from '@/store/useMealPlannerStore';
import { useRecipeWeekStore } from '@/store/useRecipeWeekStore';
import RecipeWeekPlanner from './RecipeWeekPlanner';

vi.mock('next/image', () => ({ default: ({ alt }: { alt: string }) => createElement('span', null, alt) }));
let root: Root;
let container: HTMLDivElement;

function render() { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); act(() => root.render(createElement(RecipeWeekPlanner))); }
function click(text: string) { const button = [...container.querySelectorAll('button')].find((item) => item.textContent?.includes(text)); if (!button) throw new Error(`Missing button ${text}`); act(() => button.click()); }

describe('Recipe Week planner', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    useMealPlannerStore.setState({ profile: DEFAULT_PROFILE, loggedFoods: [] });
    useRecipeWeekStore.setState({ plan: null, favorites: [], savedWeeks: [], lockedSlots: [], purchased: {}, prepCompleted: {}, householdSize: 1, hasHydrated: true, storageAvailable: true });
  });
  afterEach(() => { act(() => root?.unmount()); container?.remove(); });

  it('renders an approachable setup, generates a measured week, and never auto-logs food', () => {
    render();
    expect(container.textContent).toContain('Build your first recipe week');
    click('Generate my recipe week');
    expect(useRecipeWeekStore.getState().plan?.slots.length).toBeGreaterThan(0);
    expect(container.textContent).toContain('Your complete recipe week');
    expect(useMealPlannerStore.getState().loggedFoods).toEqual([]);
  });
});
