// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import RecipeBuilder from './RecipeBuilder';
import { DEFAULT_PROFILE, useMealPlannerStore } from '@/store/useMealPlannerStore';

const reactEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
reactEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let container: HTMLDivElement | undefined;

function resetStore(customExclusions: string[] = []) {
  useMealPlannerStore.setState({
    profile: { ...DEFAULT_PROFILE, customExclusions },
    savedRecipes: [],
  });
}

function renderRecipeBuilder(onSaved = vi.fn()) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root?.render(createElement(RecipeBuilder, { onSaved })));
  return { host: container, onSaved };
}

function setInput(host: HTMLElement, selector: string, value: string) {
  const input = host.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
  if (!input) throw new Error(`Input not found: ${selector}`);
  act(() => {
    const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function click(host: HTMLElement, text: string) {
  const button = [...host.querySelectorAll('button')].find((candidate) => candidate.textContent === text);
  if (!button) throw new Error(`Button not found: ${text}`);
  act(() => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
}

function fillRequiredFields(host: HTMLElement, options: { name?: string; yield?: string; ingredients?: string } = {}) {
  setInput(host, '#recipe-name', options.name ?? 'Test Bowl');
  setInput(host, '#recipe-yield', options.yield ?? '2');
  setInput(host, '#recipe-calories', '400');
  setInput(host, '#recipe-protein', '20');
  setInput(host, '#recipe-carbs', '50');
  setInput(host, '#recipe-fat', '10');
  setInput(host, '#recipe-ingredients', options.ingredients ?? 'rice\nbeans');
}

describe('RecipeBuilder', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetStore();
  });

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    root = undefined;
    container = undefined;
  });

  it('divides entire-batch nutrition by yield and saves the exact per-serving snapshot', () => {
    const { host, onSaved } = renderRecipeBuilder();
    fillRequiredFields(host, { name: 'Batch Chili', yield: '4', ingredients: 'beans\ntomatoes' });

    const batchSwitch = host.querySelector('#recipe-nutrition-basis') as HTMLInputElement;
    act(() => batchSwitch.click());
    setInput(host, '#recipe-calories', '1200');
    setInput(host, '#recipe-protein', '80');
    setInput(host, '#recipe-carbs', '160');
    setInput(host, '#recipe-fat', '40');
    click(host, 'Save recipe');

    expect(useMealPlannerStore.getState().savedRecipes).toEqual([
      expect.objectContaining({
        name: 'Batch Chili',
        servings: 4,
        calories: 300,
        proteinGrams: 20,
        carbGrams: 40,
        fatGrams: 10,
        ingredients: ['beans', 'tomatoes'],
      }),
    ]);
    expect(host.textContent).toContain('Saved Batch Chili. Nutrition is stored per serving.');
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('does not save when the yield is not positive', () => {
    const { host, onSaved } = renderRecipeBuilder();
    fillRequiredFields(host, { yield: '0' });

    click(host, 'Save recipe');

    expect(useMealPlannerStore.getState().savedRecipes).toEqual([]);
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('Servings must be greater than zero.');
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('saves an excluded recipe but warns that Recipe Box will block its use', () => {
    resetStore(['peanuts']);
    const { host } = renderRecipeBuilder();
    fillRequiredFields(host, { name: 'Peanut Rice Bowl', ingredients: 'peanuts\nrice' });

    click(host, 'Save recipe');

    expect(useMealPlannerStore.getState().savedRecipes).toEqual([
      expect.objectContaining({ name: 'Peanut Rice Bowl', ingredients: ['peanuts', 'rice'] }),
    ]);
    expect(host.textContent).toContain('Saved with a dietary warning: Contains excluded ingredient: peanuts');
    expect(host.textContent).toContain('Recipe Box will prevent logging or planning this recipe');
  });
});
