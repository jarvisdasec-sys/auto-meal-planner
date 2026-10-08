// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  logFood: vi.fn(), addCustomFood: vi.fn(), addSavedRecipe: vi.fn(),
  state: null as unknown,
  lookupProductByBarcode: vi.fn(),
}));
mocks.state = { foodCatalog: [], logFood: mocks.logFood, addCustomFood: mocks.addCustomFood, addSavedRecipe: mocks.addSavedRecipe };

vi.mock('@/store/useMealPlannerStore', () => ({ useMealPlannerStore: (selector: (state: typeof mocks.state) => unknown) => selector(mocks.state) }));
vi.mock('@/lib/openFoodFacts', () => ({
  isValidBarcode: (value: unknown) => typeof value === 'string' && /^\d{8}$/.test(value),
  lookupProductByBarcode: mocks.lookupProductByBarcode,
}));
vi.mock('./BarcodeScannerModal', () => ({
  default: ({ open, onManualLookup }: { open: boolean; onManualLookup: (barcode: string) => void }) => open ? createElement('button', { onClick: () => onManualLookup('12345678') }, 'Fixture manual UPC') : null,
}));
vi.mock('./CustomFoodModal', () => ({ default: () => null }));

import ScanBarcodeButton from './ScanBarcodeButton';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | null = null;
let container: HTMLDivElement | null = null;
async function render() { container = document.createElement('div'); document.body.append(container); root = createRoot(container); await act(async () => { root!.render(createElement(ScanBarcodeButton)); }); return container; }
async function click(element: Element) { await act(async () => { element.dispatchEvent(new MouseEvent('click', { bubbles: true })); await Promise.resolve(); }); }
afterEach(async () => { await act(async () => { root?.unmount(); }); container?.remove(); root = null; container = null; mocks.logFood.mockReset(); mocks.addCustomFood.mockReset(); mocks.addSavedRecipe.mockReset(); mocks.lookupProductByBarcode.mockReset(); });

describe('ScanBarcodeButton repair', () => {
  it('uses a known manual UPC to preserve explicit OFF serving basis, safe image, and unknown price metadata', async () => {
    mocks.lookupProductByBarcode.mockResolvedValue({ status: 'found', product: {
      barcode: '12345678', name: 'Fixture product', imageUrl: 'https://images.openfoodfacts.org/images/products/fixture.jpg', allergens: ['milk'], ingredients: ['milk', 'oats'],
      nutrition: { basis: 'serving', label: '1 serving (30 g)', calories: 120, proteinGrams: 3, carbGrams: 21, fatGrams: 2 },
    } });
    const view = await render();
    await click([...view.querySelectorAll('button')].find((button) => button.textContent === 'Scan Barcode')!);
    await click([...view.querySelectorAll('button')].find((button) => button.textContent === 'Fixture manual UPC')!);
    await act(async () => { await Promise.resolve(); });

    expect(mocks.addCustomFood).toHaveBeenCalledWith(expect.objectContaining({ barcode: '12345678', portionRaw: '1 serving (30 g)', caloriesRaw: 120, imageUrl: 'https://images.openfoodfacts.org/images/products/fixture.jpg', priceAvailability: expect.objectContaining({ walmart: false }) }));
    expect(mocks.logFood).toHaveBeenCalledWith(expect.stringMatching(/^barcode-log-12345678-/), 'Fixture product', 120, 'raw', 'raw', undefined, 'snacks', { proteinGrams: 3, carbGrams: 21, fatGrams: 2 }, expect.objectContaining({ portion: '1 serving (30 g)', imageUrl: 'https://images.openfoodfacts.org/images/products/fixture.jpg', source: 'barcode_open_food_facts' }));
  });
});
