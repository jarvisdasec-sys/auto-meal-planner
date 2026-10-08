'use client';

import { useMemo, useState } from 'react';
import { getActiveWeeklyPlan, useMealPlannerStore } from '@/store/useMealPlannerStore';
import {
  calculateFoodNutrition,
  calculateMetabolicSummary,
  evaluateDietarySafety,
  requiresOilInput,
  splitCaloriesAcrossMeals,
} from '@/lib/fitnessMealPlanner';
import type { CookingMethod, DietaryWarning, MealWindow, OilAddition, OilType } from '@/lib/fitnessMealPlanner';
import { getSafeSwap, type CatalogFoodItem, type SafeSwapSuggestion } from '@/lib/foodCatalog';
import {
  aggregateBatchPrepList,
  buildMealWindowGroups,
  computePantryInventory,
  filterFoodsByTimeBudget,
  generateUseWhatIHaveSuggestion,
  getDayName,
  type TimeBudget,
  type WeeklyMealSlot,
} from '@/lib/pantryPlanner';
import { getWeeklyPlanDate } from '@/lib/weeklyPlan';
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

const MEAL_WINDOWS: MealWindow[] = ['breakfast', 'lunch', 'dinner', 'snacks'];
const TIME_BUDGETS: TimeBudget[] = ['express_5', 'quick_15', 'standard_30', 'batch_prep'];
const TIME_BUDGET_LABELS: Record<TimeBudget, string> = {
  express_5: '5 min (Express)',
  quick_15: '15 min (Quick)',
  standard_30: '30 min (Standard)',
  batch_prep: 'Batch Prep',
};

type PortionMode = 'raw' | 'cooked';

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * The Daily Meal Plan renders only resolved slots from the persisted weekly plan.
 * Candidate lists are used solely as guarded replacement choices, never as cards.
 */
export default function MealPlanView() {
  const profile = useMealPlannerStore((state) => state.profile);
  const foodCatalog = useMealPlannerStore((state) => state.foodCatalog);
  const weeklyPlan = useMealPlannerStore((state) => state.weeklyPlan);
  const pantryStock = useMealPlannerStore((state) => state.pantryStock);
  const generateWeeklyPlan = useMealPlannerStore((state) => state.generateWeeklyPlan);
  const regenerateWeeklyPlan = useMealPlannerStore((state) => state.regenerateWeeklyPlan);
  const substituteWeeklyPlanSlot = useMealPlannerStore((state) => state.substituteWeeklyPlanSlot);
  const logFood = useMealPlannerStore((state) => state.logFood);

  const [portionMode, setPortionMode] = useState<PortionMode>('raw');
  const [timeBudget, setTimeBudget] = useState<TimeBudget>('standard_30');
  const [selectedDay, setSelectedDay] = useState(1);
  const [showPantryDetails, setShowPantryDetails] = useState(false);
  const [logFoodOpen, setLogFoodOpen] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [planNotice, setPlanNotice] = useState<string | null>(null);

  const summary = useMemo(() => calculateMetabolicSummary(profile), [profile]);
  const mealSplit = useMemo(() => splitCaloriesAcrossMeals(summary.targetCalories), [summary.targetCalories]);

  // Do not select this derived array from Zustand: it is intentionally resolved from
  // scalar state inputs to avoid a fresh-array selector loop on every render.
  const activeWeeklyPlan = useMemo(
    () => getActiveWeeklyPlan({ weeklyPlan, foodCatalog, profile }),
    [weeklyPlan, foodCatalog, profile],
  );
  const allFoodsByMeal = useMemo(() => buildMealWindowGroups(foodCatalog, profile), [foodCatalog, profile]);
  const selectedDaySlots = useMemo(
    () => activeWeeklyPlan.filter((slot) => slot.day === selectedDay),
    [activeWeeklyPlan, selectedDay],
  );
  const batchPrepList = useMemo(() => aggregateBatchPrepList(activeWeeklyPlan), [activeWeeklyPlan]);
  const pantryEntries = useMemo(
    () => computePantryInventory(activeWeeklyPlan, pantryStock),
    [activeWeeklyPlan, pantryStock],
  );
  const useWhatIHaveSuggestion = useMemo(
    () => generateUseWhatIHaveSuggestion(pantryEntries),
    [pantryEntries],
  );
  const selectedDayDate = useMemo(() => {
    if (!weeklyPlan) return undefined;
    try {
      return getWeeklyPlanDate(weeklyPlan, selectedDay);
    } catch {
      return undefined;
    }
  }, [selectedDay, weeklyPlan]);

  /**
   * A replacement must be a real food for the same meal window, fit the chosen
   * time budget, and remove all currently-known dietary warnings. GI warnings are
   * non-blocking for planning, but never advertised as a one-click "safe" swap.
   */
  const safeReplacementChoices = useMemo(() => {
    return MEAL_WINDOWS.reduce<Record<MealWindow, CatalogFoodItem[]>>((choices, mealWindow) => {
      choices[mealWindow] = filterFoodsByTimeBudget(allFoodsByMeal[mealWindow], timeBudget).filter((food) => {
        const evaluation = evaluateDietarySafety(food, profile);
        return !evaluation.hardBlocked && evaluation.warnings.length === 0;
      });
      return choices;
    }, { breakfast: [], lunch: [], dinner: [], snacks: [] });
  }, [allFoodsByMeal, profile, timeBudget]);

  const generatePlan = () => {
    setPlanError(null);
    setPlanNotice(null);
    try {
      generateWeeklyPlan();
      setSelectedDay(1);
      setPlanNotice('A new seven-day plan was generated from foods allowed by your profile.');
    } catch (error) {
      setPlanError(errorMessage(error, 'We could not generate a weekly plan. Review your dietary settings and try again.'));
    }
  };

  const regeneratePlan = () => {
    setPlanError(null);
    setPlanNotice(null);
    try {
      regenerateWeeklyPlan();
      setSelectedDay(1);
      setPlanNotice('Your weekly plan was regenerated using your current profile and food catalog.');
    } catch (error) {
      setPlanError(errorMessage(error, 'We could not regenerate the weekly plan. Review your dietary settings and try again.'));
    }
  };

  const substituteSlot = (slot: WeeklyMealSlot, replacementFoodId: string): string | undefined => {
    setPlanError(null);
    setPlanNotice(null);
    const replacement = foodCatalog.find((food) => food.id === replacementFoodId);
    if (!replacement) return 'That replacement is no longer available. Generate the plan again and choose another food.';
    const evaluation = evaluateDietarySafety(replacement, profile);
    if (evaluation.hardBlocked || evaluation.warnings.length > 0 || !replacement.mealWindows.includes(slot.mealWindow)) {
      return 'That replacement does not meet the current meal-window and dietary safety requirements.';
    }
    try {
      substituteWeeklyPlanSlot(slot.day, slot.mealWindow, replacementFoodId, slot.servings ?? 1);
      setPlanNotice(`${replacement.name} now replaces ${slot.food.name} on Day ${slot.day} for ${MEAL_LABELS[slot.mealWindow].toLowerCase()}.`);
      return undefined;
    } catch (error) {
      const message = errorMessage(error, 'We could not replace that planned meal. Choose another allowed food and try again.');
      setPlanError(message);
      return message;
    }
  };

  const logPlannedFood = (
    slot: WeeklyMealSlot,
    payload: {
      calories: number;
      proteinGrams: number;
      carbGrams: number;
      fatGrams: number;
      cookingMethod: CookingMethod;
      oilAddition?: OilAddition;
      portion: string;
    },
  ): string | undefined => {
    try {
      logFood(
        slot.food.id,
        slot.food.name,
        payload.calories,
        portionMode,
        payload.cookingMethod,
        payload.oilAddition,
        slot.mealWindow,
        {
          proteinGrams: payload.proteinGrams,
          carbGrams: payload.carbGrams,
          fatGrams: payload.fatGrams,
        },
        {
          servings: slot.servings ?? 1,
          portion: payload.portion,
          imageUrl: slot.food.imageUrl,
          ingredients: slot.food.ingredients,
          allergens: slot.food.dietaryTags.allergens,
          dietaryFlags: slot.food.dietaryTags,
          source: 'weekly_plan',
          dateKey: selectedDayDate,
        },
      );
      return undefined;
    } catch (error) {
      return errorMessage(error, 'We could not log this planned food. Check its dietary details and try again.');
    }
  };

  const handleManualLog = (input: LogFoodInput) => {
    try {
      logFood(
        `manual-${crypto.randomUUID()}`,
        input.name,
        input.calories,
        'raw',
        'raw',
        undefined,
        input.mealType,
        { proteinGrams: input.proteinGrams, carbGrams: input.carbGrams, fatGrams: input.fatGrams },
        { source: input.source ?? 'manual', servings: input.servings ?? 1, portion: input.portion },
      );
      setPlanError(null);
    } catch (error) {
      setPlanError(errorMessage(error, 'We could not log this food. Check the values and try again.'));
      throw error;
    }
  };

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => setLogFoodOpen(true)}
        className="w-full rounded-xl bg-accent-green/90 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-accent-green/20 transition-colors hover:bg-accent-green"
      >
        + Log Food / Meal
      </button>

      <Card title="Quick Log" subtitle="Scan a barcode or add a custom food directly to today's log">
        <ScanBarcodeButton />
      </Card>

      <Card
        title="Your Weekly Meal Plan"
        subtitle={weeklyPlan
          ? `Saved plan starting ${weeklyPlan.startDateKey}. Regenerate when your preferences or schedule change.`
          : 'Generate a saved seven-day plan. Your selection, prep checklist, and pantry view will use the same meals.'}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-400">
            {weeklyPlan
              ? `${activeWeeklyPlan.length} planned meal slot${activeWeeklyPlan.length === 1 ? '' : 's'} are available.`
              : 'No saved weekly plan yet.'}
          </p>
          <button
            type="button"
            onClick={weeklyPlan ? regeneratePlan : generatePlan}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent/90"
          >
            {weeklyPlan ? 'Regenerate weekly plan' : 'Generate weekly plan'}
          </button>
        </div>
        {planNotice && <p role="status" className="mt-3 rounded-lg bg-accent-green/15 px-3 py-2 text-sm text-accent-green">{planNotice}</p>}
        {planError && <p role="alert" className="mt-3 rounded-lg bg-accent-red/15 px-3 py-2 text-sm text-accent-red">{planError}</p>}
        {weeklyPlan && activeWeeklyPlan.length === 0 && (
          <p className="mt-3 rounded-lg bg-accent-amber/15 px-3 py-2 text-sm text-accent-amber">
            No foods currently match every planned meal window and your hard dietary exclusions. Update your profile or catalog, then regenerate the plan.
          </p>
        )}
      </Card>

      <div className="flex flex-col gap-4 rounded-2xl border border-surface-border bg-surface-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-100">Portion View</h3>
          <p className="text-sm text-slate-400">Toggle between raw and cooked portions and their calculated nutrition.</p>
        </div>
        <div className="flex rounded-xl bg-white/5 p-1" aria-label="Portion mode">
          <button
            type="button"
            aria-pressed={portionMode === 'raw'}
            onClick={() => setPortionMode('raw')}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
              portionMode === 'raw' ? 'bg-accent text-white' : 'text-slate-300'
            }`}
          >
            Raw
          </button>
          <button
            type="button"
            aria-pressed={portionMode === 'cooked'}
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
        <p className="mb-3 text-sm text-slate-400">Use this budget to narrow the allowed replacement choices for your saved plan.</p>
        <div className="flex flex-wrap gap-2" aria-label="Available cooking time">
          {TIME_BUDGETS.map((budget) => (
            <button
              type="button"
              key={budget}
              aria-pressed={timeBudget === budget}
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

      {weeklyPlan && (
        <div className="rounded-2xl border border-surface-border bg-surface-card p-4">
          <h3 className="text-base font-semibold text-slate-100">Choose a Plan Day</h3>
          <p className="mb-3 text-sm text-slate-400">Select a day to view and adjust the meals stored in this weekly plan.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7" role="group" aria-label="Weekly plan days">
            {Array.from({ length: 7 }, (_, index) => {
              const day = index + 1;
              const date = (() => {
                try {
                  return getWeeklyPlanDate(weeklyPlan, day);
                } catch {
                  return undefined;
                }
              })();
              return (
                <button
                  type="button"
                  key={day}
                  aria-pressed={selectedDay === day}
                  onClick={() => setSelectedDay(day)}
                  className={`rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors ${
                    selectedDay === day ? 'bg-accent text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <span className="block">Day {day}</span>
                  <span className="block text-[10px] opacity-80">{date ?? getDayName(day)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <Card
        title="Sunday Batch Prep Guide"
        subtitle="Meals reused in your saved plan — cook these planned portions in bulk to save time"
      >
        {!weeklyPlan ? (
          <p className="text-sm text-slate-500">Generate a weekly plan to see its prep checklist.</p>
        ) : batchPrepList.length === 0 ? (
          <p className="text-sm text-slate-500">No planned foods repeat this week yet.</p>
        ) : (
          <div className="space-y-3">
            {batchPrepList.map((item) => (
              <div key={item.foodId} className="rounded-xl bg-white/5 p-3">
                <p className="text-sm font-semibold text-slate-100">
                  Cook {item.timesPerWeek} planned serving{item.timesPerWeek === 1 ? '' : 's'} of {item.name}{' '}
                  <span className="font-normal text-slate-400">({item.portionCooked} each)</span>
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {item.usage.map((slot) => (
                    <span
                      key={`${slot.day}-${slot.mealWindow}`}
                      className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent"
                    >
                      Day {slot.day} {MEAL_LABELS[slot.mealWindow]}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Pantry & Use-It-Up" subtitle="On-hand portions and expiry notes are applied only to foods in this saved plan.">
        {!weeklyPlan ? (
          <p className="text-sm text-slate-500">Generate a weekly plan to see which recorded pantry portions it can cover.</p>
        ) : pantryEntries.length === 0 ? (
          <p className="text-sm text-slate-500">There are no planned foods to compare with pantry inventory yet.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-slate-400">
                {pantryEntries.filter((entry) => entry.onHandPortions > 0).length
                  ? `${pantryEntries.filter((entry) => entry.onHandPortions > 0).length} planned item(s) have recorded pantry stock.`
                  : 'No recorded pantry portions cover this plan yet; repeated meals do not imply items are on hand.'}
              </p>
              <button
                type="button"
                onClick={() => setShowPantryDetails((previous) => !previous)}
                className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/20"
              >
                {showPantryDetails ? 'Hide pantry details' : 'Show pantry details'}
              </button>
            </div>
            {showPantryDetails && (
              <div className="mt-3 space-y-2">
                {pantryEntries.map((entry) => (
                  <div key={entry.foodId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm">
                    <span className="font-medium text-slate-200">{entry.name}</span>
                    <span className="text-xs text-slate-400">
                      Planned {entry.plannedPortions} · On hand {entry.onHandPortions} · To buy {entry.toBuyPortions}
                      {entry.expiresOn ? ` · Expires ${entry.expiresOn}` : ''}
                    </span>
                  </div>
                ))}
                {useWhatIHaveSuggestion ? (
                  <div className="rounded-lg bg-accent-amber/15 p-3 text-sm text-slate-200">
                    <p className="font-semibold text-accent-amber">{useWhatIHaveSuggestion.title}</p>
                    <p className="mt-1 text-xs text-slate-400">{useWhatIHaveSuggestion.note}</p>
                  </div>
                ) : (
                  <p className="rounded-lg bg-white/5 p-3 text-xs text-slate-400">
                    No recorded planned pantry item is expiring soon, so there is no use-it-up suggestion right now.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </Card>

      {MEAL_WINDOWS.map((mealWindow) => {
        const slot = selectedDaySlots.find((candidate) => candidate.mealWindow === mealWindow);
        return (
          <Card
            key={mealWindow}
            title={`${MEAL_LABELS[mealWindow]} — ${Math.round(mealSplit[mealWindow])} kcal target`}
            subtitle={mealWindow === 'snacks' ? `Filtered by cravings: ${profile.snackCravings.join(', ') || 'none selected'}` : undefined}
          >
            {!weeklyPlan ? (
              <p className="text-sm text-slate-500">Generate a weekly plan to add a saved {MEAL_LABELS[mealWindow].toLowerCase()} selection.</p>
            ) : !slot ? (
              <p className="text-sm text-slate-500">
                No matching safe {MEAL_LABELS[mealWindow].toLowerCase()} candidate is available for Day {selectedDay}. Review dietary settings or regenerate the plan.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:max-w-md">
                <FoodItemCard
                  key={`${slot.day}-${slot.mealWindow}-${slot.food.id}`}
                  slot={slot}
                  portionMode={portionMode}
                  warnings={evaluateDietarySafety(slot.food, profile).warnings}
                  safeSwap={getSafeSwap(slot.food.id)}
                  replacementChoices={safeReplacementChoices[mealWindow]}
                  timeBudgetLabel={TIME_BUDGET_LABELS[timeBudget]}
                  onLogFood={logPlannedFood}
                  onSubstitute={substituteSlot}
                />
              </div>
            )}
          </Card>
        );
      })}

      <LogFoodModal open={logFoodOpen} onClose={() => setLogFoodOpen(false)} onSave={handleManualLog} />
    </div>
  );
}

function FoodItemCard({
  slot,
  portionMode,
  warnings,
  safeSwap,
  replacementChoices,
  timeBudgetLabel,
  onLogFood,
  onSubstitute,
}: {
  slot: WeeklyMealSlot;
  portionMode: PortionMode;
  warnings: DietaryWarning[];
  safeSwap?: SafeSwapSuggestion;
  replacementChoices: CatalogFoodItem[];
  timeBudgetLabel: string;
  onLogFood: (
    slot: WeeklyMealSlot,
    payload: {
      calories: number;
      proteinGrams: number;
      carbGrams: number;
      fatGrams: number;
      cookingMethod: CookingMethod;
      oilAddition?: OilAddition;
      portion: string;
    },
  ) => string | undefined;
  onSubstitute: (slot: WeeklyMealSlot, replacementFoodId: string) => string | undefined;
}) {
  const { food } = slot;
  const portionGuide = getPortionGuideForCategory(food.category);
  const [method, setMethod] = useState<CookingMethod>(food.cookingOptions[0]?.method ?? 'raw');
  const [oilType, setOilType] = useState<OilType>('olive_oil');
  const [oilAmount, setOilAmount] = useState(0);
  const [oilUnit, setOilUnit] = useState<'tbsp' | 'tsp'>('tbsp');
  const [replacementFoodId, setReplacementFoodId] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const portion = portionMode === 'raw' ? food.portionRaw : food.portionCooked;
  const oilAddition = useMemo(
    () => (requiresOilInput(method) ? { oilType, amount: oilAmount, unit: oilUnit } : undefined),
    [method, oilAmount, oilType, oilUnit],
  );
  const nutrition = useMemo(
    () => calculateFoodNutrition(food, portionMode, method, oilAddition, slot.servings ?? 1),
    [food, method, oilAddition, portionMode, slot.servings],
  );
  const alternatives = replacementChoices.filter((candidate) => candidate.id !== food.id);
  const safeSwapAlternative = safeSwap?.alternativeFoodId
    ? alternatives.find((candidate) => candidate.id === safeSwap.alternativeFoodId)
    : undefined;
  const controlPrefix = `meal-${slot.day}-${slot.mealWindow}-${food.id}`;

  const logThisFood = () => {
    setActionError(null);
    const error = onLogFood(slot, {
      calories: nutrition.calories,
      proteinGrams: nutrition.proteinGrams,
      carbGrams: nutrition.carbGrams,
      fatGrams: nutrition.fatGrams,
      cookingMethod: method,
      oilAddition: nutrition.oilAddition,
      portion,
    });
    if (error) setActionError(error);
    else setActionNotice(`${food.name} was logged as ${MEAL_LABELS[slot.mealWindow].toLowerCase()} with its selected portion and cooking details.`);
  };

  const replaceMeal = (foodId: string) => {
    if (!foodId) {
      setActionError('Choose an allowed replacement before replacing this planned meal.');
      return;
    }
    setActionError(null);
    const error = onSubstitute(slot, foodId);
    if (error) setActionError(error);
  };

  return (
    <div className="flex flex-col justify-between overflow-hidden rounded-xl border border-surface-border bg-white/5">
      <FoodImage
        src={food.imageUrl}
        alt={food.name}
        portionGuide={portionGuide.guide}
        item={{ id: food.id, name: food.name, upc: food.barcode, ingredientQuery: food.name }}
      />
      <div className="space-y-2 p-4">
        <div>
          <h4 className="text-sm font-semibold text-slate-100">{food.name}</h4>
          <p className="mt-0.5 text-xs text-slate-400">Day {slot.day} · {MEAL_LABELS[slot.mealWindow]} · {slot.servings ?? 1} serving{(slot.servings ?? 1) === 1 ? '' : 's'}</p>
        </div>
        <p className="text-xs text-slate-400">{portionMode === 'raw' ? 'Raw' : 'Cooked'} portion: {portion}</p>
        <p className="text-lg font-bold text-accent-green">{nutrition.calories} kcal</p>
        <p className="text-xs text-slate-500">P {nutrition.proteinGrams}g · C {nutrition.carbGrams}g · F {nutrition.fatGrams}g</p>
        <p className="text-[11px] text-slate-500">
          Nutrition uses the selected {portionMode} calorie basis, cooking method, entered oil, and planned servings. Oil is counted once.
        </p>

        {warnings.length > 0 && (
          <div className="space-y-1" aria-label="Dietary guidance">
            {warnings.map((warning) => (
              <p
                key={warning.label}
                className={`rounded-md px-2 py-1 text-[11px] font-medium ${
                  warning.severity === 'red' ? 'bg-accent-red/15 text-accent-red' : 'bg-accent-amber/15 text-accent-amber'
                }`}
              >
                {warning.label}
              </p>
            ))}
            {safeSwap && (
              <div className="rounded-lg bg-white/5 p-2 text-[11px] text-slate-300">
                <p className="font-semibold text-accent-green">Suggestion: {safeSwap.alternativeName}</p>
                <p className="mt-0.5 text-slate-400">{safeSwap.reason}</p>
                {safeSwapAlternative ? (
                  <button
                    type="button"
                    onClick={() => replaceMeal(safeSwapAlternative.id)}
                    className="mt-2 rounded-lg bg-accent-green/90 px-2 py-1 text-[11px] font-semibold text-white hover:bg-accent-green"
                  >
                    Replace planned meal with {safeSwapAlternative.name}
                  </button>
                ) : (
                  <p className="mt-2 text-slate-400">
                    This is guidance only. No catalog alternative currently satisfies this meal window, your dietary guidance, and the {timeBudgetLabel} time budget.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <CookingMethodControls
          idPrefix={controlPrefix}
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

        <div className="rounded-lg border border-surface-border/70 bg-black/10 p-2">
          <label htmlFor={`${controlPrefix}-replacement`} className="block text-xs font-semibold text-slate-200">Replace planned meal (optional)</label>
          {alternatives.length > 0 ? (
            <>
              <select
                id={`${controlPrefix}-replacement`}
                value={replacementFoodId}
                onChange={(event) => setReplacementFoodId(event.target.value)}
                className="input mt-1 py-1 text-xs"
              >
                <option value="">Choose an allowed replacement</option>
                {alternatives.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => replaceMeal(replacementFoodId)}
                className="mt-2 rounded-lg bg-white/10 px-2 py-1 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/20"
              >
                Replace meal
              </button>
            </>
          ) : (
            <p className="mt-1 text-xs text-slate-400">
              No safer replacement matches this meal window and the {timeBudgetLabel} budget. Choose a longer budget or review your dietary settings.
            </p>
          )}
        </div>

        {actionNotice && <p role="status" className="rounded-md bg-accent-green/15 px-2 py-1 text-xs text-accent-green">{actionNotice}</p>}
        {actionError && <p role="alert" className="rounded-md bg-accent-red/15 px-2 py-1 text-xs text-accent-red">{actionError}</p>}
      </div>
      <button
        type="button"
        onClick={logThisFood}
        className="mx-4 mb-4 mt-3 rounded-lg bg-accent/90 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent"
      >
        Log {MEAL_LABELS[slot.mealWindow]}
      </button>
    </div>
  );
}
