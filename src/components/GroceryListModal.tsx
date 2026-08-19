'use client';

import { useMemo } from 'react';
import Modal from './ui/Modal';
import { filterSnacksByCravings } from '@/lib/fitnessMealPlanner';
import type { SnackCraving, StoreName } from '@/lib/fitnessMealPlanner';
import type { CatalogFoodItem, FoodCategory } from '@/lib/foodCatalog';

interface GroceryListModalProps {
  open: boolean;
  onClose: () => void;
  foodCatalog: CatalogFoodItem[];
  snackCravings: SnackCraving[];
  preferredStore: StoreName;
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

// A few items read more naturally under Dairy than their base category aisle
const AISLE_OVERRIDES: Record<string, Aisle> = {
  'egg-whites': 'Dairy',
  'greek-yogurt': 'Dairy',
};

function getAisle(food: CatalogFoodItem): Aisle {
  return AISLE_OVERRIDES[food.id] ?? AISLE_BY_CATEGORY[food.category];
}

const DAYS_IN_PLAN = 7;

export default function GroceryListModal({
  open,
  onClose,
  foodCatalog,
  snackCravings,
  preferredStore,
}: GroceryListModalProps) {
  const groupedList = useMemo(() => {
    const mealFoods = foodCatalog.filter((food) => !food.mealWindows.includes('snacks'));
    const snackFoods = filterSnacksByCravings(
      foodCatalog.filter((food) => food.mealWindows.includes('snacks')),
      snackCravings,
    ) as CatalogFoodItem[];

    const allFoods = [...mealFoods, ...snackFoods];

    const groups = new Map<Aisle, CatalogFoodItem[]>();
    for (const aisle of AISLE_ORDER) groups.set(aisle, []);
    for (const food of allFoods) {
      groups.get(getAisle(food))?.push(food);
    }
    return groups;
  }, [foodCatalog, snackCravings]);

  const weeklyTotal = useMemo(() => {
    let total = 0;
    for (const foods of groupedList.values()) {
      for (const food of foods) {
        total += food.estimatedPrices[preferredStore] * DAYS_IN_PLAN;
      }
    }
    return total;
  }, [groupedList, preferredStore]);

  return (
    <Modal open={open} onClose={onClose} title="7-Day Grocery List">
      <div className="print-area max-h-[70vh] overflow-y-auto">
        <p className="mb-4 text-sm text-slate-400">
          Aggregated ingredients for your current meal plan, quantities for {DAYS_IN_PLAN} days.
        </p>
        <div className="space-y-5">
          {AISLE_ORDER.map((aisle) => {
            const foods = groupedList.get(aisle) ?? [];
            if (foods.length === 0) return null;
            return (
              <div key={aisle}>
                <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-accent-green">{aisle}</h4>
                <ul className="space-y-1.5">
                  {foods.map((food) => (
                    <li key={food.id} className="flex items-center gap-2 text-sm text-slate-200">
                      <input type="checkbox" className="accent-accent-green" />
                      <span>
                        {food.name} — {DAYS_IN_PLAN}x {food.portionRaw}
                      </span>
                      <span className="ml-auto text-xs text-slate-400">
                        ${(food.estimatedPrices[preferredStore] * DAYS_IN_PLAN).toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        <div className="mt-5 flex items-center justify-between border-t border-surface-border pt-3 text-sm font-semibold text-slate-100">
          <span>Estimated Weekly Total</span>
          <span>${weeklyTotal.toFixed(2)}</span>
        </div>
      </div>
      <div className="no-print mt-5 flex gap-2">
        <button
          onClick={() => window.print()}
          className="flex-1 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent/90"
        >
          Print List
        </button>
        <button
          onClick={onClose}
          className="rounded-lg bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/10"
        >
          Close
        </button>
      </div>
    </Modal>
  );
}
