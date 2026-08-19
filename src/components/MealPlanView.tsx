'use client';

import { useMemo, useState } from 'react';
import { useMealPlannerStore } from '@/store/useMealPlannerStore';
import {
  calculateMetabolicSummary,
  splitCaloriesAcrossMeals,
  filterSnacksByCravings,
  compareRawAndCookedCalories,
} from '@/lib/fitnessMealPlanner';
import type { MealWindow } from '@/lib/fitnessMealPlanner';
import type { CatalogFoodItem } from '@/lib/foodCatalog';
import Card from './ui/Card';
import ScanBarcodeButton from './ScanBarcodeButton';

const MEAL_LABELS: Record<MealWindow, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
};

type PortionMode = 'raw' | 'cooked';

export default function MealPlanView() {
  const profile = useMealPlannerStore((s) => s.profile);
  const foodCatalog = useMealPlannerStore((s) => s.foodCatalog);
  const logFood = useMealPlannerStore((s) => s.logFood);
  const [portionMode, setPortionMode] = useState<PortionMode>('raw');

  const summary = useMemo(() => calculateMetabolicSummary(profile), [profile]);
  const mealSplit = useMemo(() => splitCaloriesAcrossMeals(summary.targetCalories), [summary.targetCalories]);

  const foodsByMeal = useMemo(() => {
    const result: Record<MealWindow, CatalogFoodItem[]> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snacks: [],
    };
    for (const food of foodCatalog) {
      for (const window of food.mealWindows) {
        if (window === 'snacks') continue;
        result[window].push(food);
      }
    }
    result.snacks = filterSnacksByCravings(
      foodCatalog.filter((f) => f.mealWindows.includes('snacks')),
      profile.snackCravings,
    ) as CatalogFoodItem[];
    return result;
  }, [foodCatalog, profile.snackCravings]);

  return (
    <div className="space-y-6">
      <Card title="Quick Log" subtitle="Scan a barcode or add a custom food directly to today's log">
        <ScanBarcodeButton />
      </Card>

      <div className="flex items-center justify-between rounded-2xl border border-surface-border bg-surface-card p-4">
        <div>
          <h3 className="text-base font-semibold text-slate-100">Portion View</h3>
          <p className="text-sm text-slate-400">Toggle between raw and cooked portions/calories</p>
        </div>
        <div className="flex rounded-xl bg-white/5 p-1">
          <button
            onClick={() => setPortionMode('raw')}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
              portionMode === 'raw' ? 'bg-accent text-white' : 'text-slate-300'
            }`}
          >
            Raw
          </button>
          <button
            onClick={() => setPortionMode('cooked')}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
              portionMode === 'cooked' ? 'bg-accent text-white' : 'text-slate-300'
            }`}
          >
            Cooked
          </button>
        </div>
      </div>

      {(Object.keys(MEAL_LABELS) as MealWindow[]).map((window) => (
        <Card
          key={window}
          title={`${MEAL_LABELS[window]} — ${Math.round(mealSplit[window])} kcal target`}
          subtitle={window === 'snacks' ? `Filtered by cravings: ${profile.snackCravings.join(', ') || 'none selected'}` : undefined}
        >
          {foodsByMeal[window].length === 0 ? (
            <p className="text-sm text-slate-500">No matching foods for this meal window.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {foodsByMeal[window].map((food) => (
                <FoodItemCard
                  key={food.id}
                  food={food}
                  portionMode={portionMode}
                  onLogFood={() => {
                    const comparison = compareRawAndCookedCalories(food);
                    const calories = portionMode === 'raw' ? comparison.caloriesRaw : comparison.caloriesCooked;
                    logFood(food.id, food.name, calories, portionMode);
                  }}
                />
              ))}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

function FoodItemCard({
  food,
  portionMode,
  onLogFood,
}: {
  food: CatalogFoodItem;
  portionMode: PortionMode;
  onLogFood: () => void;
}) {
  const comparison = compareRawAndCookedCalories(food);
  const portion = portionMode === 'raw' ? comparison.portionRaw : comparison.portionCooked;
  const calories = portionMode === 'raw' ? comparison.caloriesRaw : comparison.caloriesCooked;

  return (
    <div className="flex flex-col justify-between rounded-xl border border-surface-border bg-white/5 p-4">
      <div>
        <h4 className="text-sm font-semibold text-slate-100">{food.name}</h4>
        <p className="mt-1 text-xs text-slate-400">
          {portionMode === 'raw' ? 'Raw' : 'Cooked'} portion: {portion}
        </p>
        <p className="text-lg font-bold text-accent-green">{calories} kcal</p>
        <p className="text-xs text-slate-500">
          P {food.proteinGrams}g · C {food.carbGrams}g · F {food.fatGrams}g
        </p>
      </div>
      <button
        onClick={onLogFood}
        className="mt-3 rounded-lg bg-accent/90 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent"
      >
        Log Food
      </button>
    </div>
  );
}
