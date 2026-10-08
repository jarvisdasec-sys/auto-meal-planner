// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import CookingMethodControls from './CookingMethodControls';
import { FOOD_CATALOG } from '@/lib/foodCatalog';

it('bounds oil previews and entered values without silently editing a legacy stored amount', () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const onChange = vi.fn();
  act(() => root.render(createElement(CookingMethodControls, {
    cookingOptions: FOOD_CATALOG.find((food) => food.id === 'tofu')!.cookingOptions,
    method: 'pan_fried', onMethodChange: vi.fn(), oilType: 'olive_oil', onOilTypeChange: vi.fn(),
    oilAmount: 999, onOilAmountChange: onChange, oilUnit: 'tbsp', onOilUnitChange: vi.fn(),
  })));
  const input = container.querySelector('input[aria-label="Oil amount"]') as HTMLInputElement;
  expect(input.value).toBe('32');
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('saved entry is unchanged');
  expect(onChange).not.toHaveBeenCalled();
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '1000');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(onChange).toHaveBeenCalledWith(32);
  act(() => root.unmount());
  container.remove();
});
