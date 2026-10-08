'use client';

import { useMemo, useState } from 'react';
import Modal from './ui/Modal';
import type { SnackCraving, StoreName } from '@/lib/fitnessMealPlanner';
import type { CatalogFoodItem, FoodCategory } from '@/lib/foodCatalog';
import {
  estimatePlanGroceryCost,
  getGroceryRequirements,
  type GroceryRequirement,
  type PantryStock,
  type WeeklyMealSlot,
} from '@/lib/pantryPlanner';

interface GroceryListModalProps {
  open: boolean;
  onClose: () => void;
  foodCatalog: CatalogFoodItem[];
  preferredStore: StoreName;
  /** Authoritative active-plan requirements. New callers should always provide this. */
  requirements?: GroceryRequirement[];
  /** Retained for old callers; snack filtering is now resolved before a plan is persisted. */
  snackCravings?: SnackCraving[];
  /** Backward-compatible way for a caller to provide plan data without precomputing requirements. */
  slots?: WeeklyMealSlot[];
  pantryStock?: PantryStock;
}

const AISLE_ORDER = ['Produce', 'Meat/Seafood', 'Dairy', 'Pantry/Grains', 'Snacks'] as const;
type Aisle = (typeof AISLE_ORDER)[number];

const AISLE_BY_CATEGORY: Record<FoodCategory, Aisle> = {
  protein: 'Meat/Seafood',
  carb: 'Pantry/Grains',
  fat: 'Pantry/Grains',
  vegetable: 'Produce',
  snack: 'Snacks',
};

// A few items read more naturally under Dairy than their base category aisle.
const AISLE_OVERRIDES: Record<string, Aisle> = {
  'egg-whites': 'Dairy',
  'greek-yogurt': 'Dairy',
};

function getAisle(requirement: GroceryRequirement): Aisle {
  return AISLE_OVERRIDES[requirement.foodId] ?? AISLE_BY_CATEGORY[requirement.category];
}

function formatPortions(portions: number): string {
  const rounded = Math.round(portions * 100) / 100;
  return `${rounded} portion${rounded === 1 ? '' : 's'}`;
}

export default function GroceryListModal({
  open,
  onClose,
  foodCatalog,
  preferredStore,
  requirements,
  slots,
  pantryStock,
}: GroceryListModalProps) {
  const [printError, setPrintError] = useState<string | null>(null);
  const activeRequirements = useMemo(
    () => requirements ?? getGroceryRequirements(slots ?? [], pantryStock),
    [requirements, slots, pantryStock],
  );
  const groupedList = useMemo(() => {
    const groups = new Map<Aisle, GroceryRequirement[]>();
    for (const aisle of AISLE_ORDER) groups.set(aisle, []);
    for (const requirement of activeRequirements) {
      groups.get(getAisle(requirement))?.push(requirement);
    }
    for (const foods of groups.values()) foods.sort((left, right) => left.name.localeCompare(right.name));
    return groups;
  }, [activeRequirements]);
  const planCost = useMemo(
    () => estimatePlanGroceryCost(activeRequirements, foodCatalog, preferredStore),
    [activeRequirements, foodCatalog, preferredStore],
  );
  const unavailableFoodIds = useMemo(
    () => new Set(planCost.unknownPriceFoodIds),
    [planCost.unknownPriceFoodIds],
  );
  const lineCosts = useMemo(() => new Map(
    activeRequirements.map((requirement) => [
      requirement.foodId,
      estimatePlanGroceryCost([requirement], foodCatalog, preferredStore),
    ]),
  ), [activeRequirements, foodCatalog, preferredStore]);

  const handlePrint = () => {
    setPrintError(null);
    try {
      if (typeof window.print !== 'function') {
        setPrintError('Printing is unavailable in this browser. Use your browser print command to save this grocery list.');
        return;
      }
      window.print();
    } catch {
      setPrintError('The print dialog could not open. Use your browser print command to save this grocery list.');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Current Plan Grocery List">
      <div className="print-area max-h-[70vh] overflow-y-auto">
        <p className="mb-4 text-sm text-slate-400">
          Aggregated from the active plan&apos;s actual servings. This is not a full-catalog or fixed seven-portion list.
        </p>
        {activeRequirements.length === 0 ? (
          <p className="rounded-lg bg-white/5 p-3 text-sm text-slate-400">
            No active weekly plan is available. Generate one in Daily Meal Plan, then reopen this list.
          </p>
        ) : (
          <div className="space-y-5">
            {AISLE_ORDER.map((aisle) => {
              const foods = groupedList.get(aisle) ?? [];
              if (foods.length === 0) return null;
              return (
                <div key={aisle}>
                  <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-accent-green">{aisle}</h4>
                  <ul className="space-y-2">
                    {foods.map((requirement) => {
                      const lineCost = lineCosts.get(requirement.foodId);
                      const priceUnavailable = unavailableFoodIds.has(requirement.foodId);
                      return (
                        <li key={requirement.foodId} className="rounded-lg bg-white/5 p-2 text-sm text-slate-200">
                          <div className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              className="mt-1 accent-accent-green"
                              aria-label={`Mark ${requirement.name} as purchased`}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-slate-100">{requirement.name}</p>
                              <p className="mt-1 text-xs text-slate-400">
                                Planned: {formatPortions(requirement.plannedPortions)} · On hand: {formatPortions(requirement.onHandPortions)} · To buy: {formatPortions(requirement.toBuyPortions)}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">Portion: {requirement.portionLabel}</p>
                            </div>
                            <span className="shrink-0 text-right text-xs text-slate-400">
                              {requirement.toBuyPortions === 0
                                ? 'Covered by pantry'
                                : priceUnavailable || lineCost?.hasUnknownPrices
                                  ? 'Price unavailable'
                                  : `Estimated $${lineCost?.subtotal.toFixed(2) ?? '—'}`}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
        {activeRequirements.length > 0 && (
          <>
            {planCost.hasUnknownPrices && (
              <p className="mt-4 rounded-lg bg-accent-amber/10 p-3 text-xs text-accent-amber" role="status">
                {planCost.unknownPriceFoodIds.length} item{planCost.unknownPriceFoodIds.length === 1 ? '' : 's'} price unavailable. Add a per-portion estimate to the food record to include it; unavailable items are never treated as free.
              </p>
            )}
            <div className="mt-5 flex items-center justify-between border-t border-surface-border pt-3 text-sm font-semibold text-slate-100">
              <span>{planCost.hasUnknownPrices ? 'Known subtotal (partial)' : 'Estimated plan subtotal'}</span>
              <span>${planCost.subtotal.toFixed(2)}</span>
            </div>
          </>
        )}
      </div>
      <div className="no-print mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handlePrint}
          className="flex-1 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent/90"
        >
          Print List
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/10"
        >
          Close
        </button>
      </div>
      {printError && <p className="no-print mt-3 text-sm text-accent-amber" role="alert">{printError}</p>}
    </Modal>
  );
}
