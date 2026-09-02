'use client';

import { useMemo, useState } from 'react';
import { useMealPlannerStore } from '@/store/useMealPlannerStore';
import {
  calculateMetabolicSummary,
  splitCaloriesAcrossMeals,
  getDietaryWarnings,
  compareRawAndCookedCalories,
  applyCookingOption,
  calculateAddedOilCalories,
  requiresOilInput,
} from '@/lib/fitnessMealPlanner';
import type { CookingMethod, DietaryWarning, MealWindow, OilAddition, OilType } from '@/lib/fitnessMealPlanner';
import { getSafeSwap, type CatalogFoodItem, type SafeSwapSuggestion } from '@/lib/foodCatalog';
import {
  buildMealWindowGroups,
  generateWeeklyMealPlan,
  aggregateBatchPrepList,
  filterFoodsByTimeBudget,
  getDayName,
  TIME_BUDGET_LABELS,
} from '@/lib/pantryPlanner';
import type { TimeBudget } from '@/lib/pantryPlanner';
import { getPortionGuideForCategory } from '@/lib/portionGuides';
import FoodImage from './FoodImage';
import Card from './ui/Card';
import ScanBarcodeButton from './ScanBarcodeButton';
import CookingMethodControls from './CookingMethodControls';
import LogFoodModal, { type LogFoodInput } from './LogFoodModal';

const MEAL_LABELS: Record<MealWindow, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
};

type PortionMode = 'raw' | 'cooked';

const TIME_BUDGETS: TimeBudget[] = ['express_5', 'quick_15', 'standard_30', 'batch_prep'];

export default function MealPlanView() {
  const profile = useMealPlannerStore((s) => s.profile);
  const foodCatalog = useMealPlannerStore((s) => s.foodCatalog);
  const logFood = useMealPlannerStore((s) => s.logFood);
  const [portionMode, setPortionMode] = useState<PortionMode>('raw');
  const [timeBudget, setTimeBudget] = useState<TimeBudget>('standard_30');
  const [logFoodOpen, setLogFoodOpen] = useState(false);

  const summary = useMemo(() => calculateMetabolicSummary(profile), [profile]);
  const mealSplit = useMemo(() => splitCaloriesAcrossMeals(summary.targetCalories), [summary.targetCalories]);

  const allFoodsByMeal = useMemo(() => buildMealWindowGroups(foodCatalog, profile), [foodCatalog, profile]);

  const foodsByMeal = useMemo(() => {
    const result: Record<MealWindow, CatalogFoodItem[]> = {
      breakfast: filterFoodsByTimeBudget(allFoodsByMeal.breakfast, timeBudget),
      lunch: filterFoodsByTimeBudget(allFoodsByMeal.lunch, timeBudget),
      dinner: filterFoodsByTimeBudget(allFoodsByMeal.dinner, timeBudget),
      snacks: filterFoodsByTimeBudget(allFoodsByMeal.snacks, timeBudget),
    };
    return result;
  }, [allFoodsByMeal, timeBudget]);

  const weeklyPlan = useMemo(() => generateWeeklyMealPlan(allFoodsByMeal), [allFoodsByMeal]);
  const batchPrepList = useMemo(() => aggregateBatchPrepList(weeklyPlan), [weeklyPlan]);

  return (
    <div className="space-y-6">
      <button
        onClick={() => setLogFoodOpen(true)}
        className="w-full rounded-xl bg-accent-green/90 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-accent-green/20 transition-colors hover:bg-accent-green"
      >
        + Log Food / Meal
      </button>

      <Card title="Quick Log" subtitle="Scan a barcode or add a custom food directly to today's log">
        <ScanBarcodeButton />
      </Card>

      <div className="flex flex-col gap-4 rounded-2xl border border-surface-border bg-surface-card p-4 sm:flex-row sm:items-center sm:justify-between">
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

      <div className="rounded-2xl border border-surface-border bg-surface-card p-4">
        <h3 className="text-base font-semibold text-slate-100">Time to Cook</h3>
        <p className="mb-3 text-sm text-slate-400">Filter recipes by how much time you have right now</p>
        <div className="flex flex-wrap gap-2">
          {TIME_BUDGETS.map((budget) => (
            <button
              key={budget}
              onClick={() => setTimeBudget(budget)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                timeBudget === budget ? 'bg-accent text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              {TIME_BUDGET_LABELS[budget]}
            </button>
          ))}
        </div>
      </div>

      <Card
        title="Sunday Batch Prep Guide"
        subtitle="Ingredients reused across the week — cook these in bulk to save time"
      >
        {batchPrepList.length === 0 ? (
          <p className="text-sm text-slate-500">No repeated ingredients this week yet.</p>
        ) : (
          <div className="space-y-3">
            {batchPrepList.map((item) => (
              <div key={item.foodId} className="rounded-xl bg-white/5 p-3">
                <p className="text-sm font-semibold text-slate-100">
                  Cook {item.timesPerWeek} servings of {item.name}{' '}
                  <span className="font-normal text-slate-400">({item.portionCooked} each)</span>
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {item.usage.map((slot) => (
                    <span
                      key={`${slot.day}-${slot.mealWindow}`}
                      className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent"
                    >
                      {getDayName(slot.day)} {MEAL_LABELS[slot.mealWindow]}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

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
                  warnings={getDietaryWarnings(food, profile)}
                  safeSwap={getSafeSwap(food.id)}
                  onLogFood={(payload) =>
                    logFood(food.id, food.name, payload.calories, portionMode, payload.cookingMethod, payload.oilAddition)
                  }
                  onLogSwap={(swap) => {
                    const altFood = swap.alternativeFoodId ? foodCatalog.find((f) => f.id === swap.alternativeFoodId) : undefined;
                    if (altFood) logFood(altFood.id, altFood.name, altFood.caloriesRaw, 'raw', 'raw');
                  }}
                />
              ))}
            </div>
          )}
        </Card>
      ))}

      <LogFoodModal
        open={logFoodOpen}
        onClose={() => setLogFoodOpen(false)}
        onSave={(input: LogFoodInput) =>
          logFood(
            `manual-${crypto.randomUUID()}`,
            input.name,
            input.calories,
            'raw',
            'raw',
            undefined,
            input.mealType,
            { proteinGrams: input.proteinGrams, carbGrams: input.carbGrams, fatGrams: input.fatGrams },
          )
        }
      />
    </div>
  );
}

function FoodItemCard({
  food,
  portionMode,
  warnings,
  safeSwap,
  onLogFood,
  onLogSwap,
}: {
  food: CatalogFoodItem;
  portionMode: PortionMode;
  warnings: DietaryWarning[];
  safeSwap?: SafeSwapSuggestion;
  onLogFood: (payload: { calories: number; cookingMethod: CookingMethod; oilAddition?: OilAddition }) => void;
  onLogSwap: (swap: SafeSwapSuggestion) => void;
}) {
  const comparison = compareRawAndCookedCalories(food);
  const portion = portionMode === 'raw' ? comparison.portionRaw : comparison.portionCooked;
  const portionGuide = getPortionGuideForCategory(food.category);
  const [showSwap, setShowSwap] = useState(false);

  const [method, setMethod] = useState<CookingMethod>(food.cookingOptions[0]?.method ?? 'raw');
  const [oilType, setOilType] = useState<OilType>('olive_oil');
  const [oilAmount, setOilAmount] = useState(1);
  const [oilUnit, setOilUnit] = useState<'tbsp' | 'tsp'>('tbsp');

  const selectedOption = food.cookingOptions.find((option) => option.method === method) ?? food.cookingOptions[0];
  const adjusted = applyCookingOption(
    { calories: food.caloriesRaw, proteinGrams: food.proteinGrams, carbGrams: food.carbGrams, fatGrams: food.fatGrams },
    selectedOption,
  );
  const oil = requiresOilInput(method) ? calculateAddedOilCalories(oilType, oilAmount, oilUnit) : null;
  const totalCalories = Math.round(adjusted.calories + (oil?.addedCalories ?? 0));
  const totalFat = Math.round((adjusted.fatGrams + (oil?.addedFatGrams ?? 0)) * 10) / 10;

  return (
    <div className="flex flex-col justify-between overflow-hidden rounded-xl border border-surface-border bg-white/5">
      <FoodImage
        src={food.imageUrl}
        alt={food.name}
        portionGuide={portionGuide.guide}
        item={{ id: food.id, name: food.name, ingredientQuery: food.name }}
      />
      <div className="space-y-2 p-4">
        <h4 className="text-sm font-semibold text-slate-100">{food.name}</h4>
        <p className="text-xs text-slate-400">
          {portionMode === 'raw' ? 'Raw' : 'Cooked'} portion: {portion}
        </p>
        <p className="text-lg font-bold text-accent-green">{totalCalories} kcal</p>
        <p className="text-xs text-slate-500">
          P {adjusted.proteinGrams}g · C {adjusted.carbGrams}g · F {totalFat}g
        </p>

        {warnings.length > 0 && (
          <div className="space-y-1">
            {warnings.map((warning) => (
              <p
                key={warning.label}
                className={`rounded-md px-2 py-1 text-[11px] font-medium ${
                  warning.severity === 'red'
                    ? 'bg-accent-red/15 text-accent-red'
                    : 'bg-accent-amber/15 text-accent-amber'
                }`}
              >
                {warning.label}
              </p>
            ))}
            <button
              type="button"
              onClick={() => setShowSwap((prev) => !prev)}
              className="rounded-lg bg-white/10 px-2 py-1 text-[11px] font-semibold text-slate-200 hover:bg-white/20"
            >
              Safe Swap
            </button>
            {showSwap && (
              <div className="rounded-lg bg-white/5 p-2 text-[11px] text-slate-300">
                {safeSwap ? (
                  <>
                    <p className="font-semibold text-accent-green">Try: {safeSwap.alternativeName}</p>
                    <p className="mt-0.5 text-slate-400">{safeSwap.reason}</p>
                    {safeSwap.alternativeFoodId && (
                      <button
                        type="button"
                        onClick={() => onLogSwap(safeSwap)}
                        className="mt-2 rounded-lg bg-accent-green/90 px-2 py-1 text-[11px] font-semibold text-white hover:bg-accent-green"
                      >
                        Log This Instead
                      </button>
                    )}
                  </>
                ) : (
                  <p>No specific swap on file yet — consider a different option that fits your dietary needs.</p>
                )}
              </div>
            )}
          </div>
        )}

        <CookingMethodControls
          cookingOptions={food.cookingOptions}
          method={method}
          onMethodChange={setMethod}
          oilType={oilType}
          onOilTypeChange={setOilType}
          oilAmount={oilAmount}
          onOilAmountChange={setOilAmount}
          oilUnit={oilUnit}
          onOilUnitChange={setOilUnit}
          compact
        />
      </div>
      <button
        onClick={() =>
          onLogFood({
            calories: totalCalories,
            cookingMethod: method,
            oilAddition: oil
              ? { oilType, amount: oilAmount, unit: oilUnit, addedCalories: oil.addedCalories, addedFatGrams: oil.addedFatGrams }
              : undefined,
          })
        }
        className="mx-4 mb-4 mt-3 rounded-lg bg-accent/90 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent"
      >
        Log Food
      </button>
    </div>
  );
}
