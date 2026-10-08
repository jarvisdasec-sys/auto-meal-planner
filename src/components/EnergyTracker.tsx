'use client';

import { useMemo, useState } from 'react';
import {
  calculateMetabolicSummary,
  getAdjustmentForDate,
  getDietaryWarnings,
  getEnergyBalanceSnapshot,
  type CookingMethod,
  type OilType,
} from '@/lib/fitnessMealPlanner';
import { isDateKey, localDateKey, type DateKey } from '@/lib/dateKeys';
import { calculateDailyNutritionTotals, getEntryNutrition, getExerciseEntriesForDate, getFoodEntriesForDate } from '@/lib/nutritionLedger';
import { formatLabel } from '@/lib/format';
import { useMealPlannerStore } from '@/store/useMealPlannerStore';
import Card from './ui/Card';
import ScanBarcodeButton from './ScanBarcodeButton';
import CookingMethodControls from './CookingMethodControls';
import EatingOutModal from './EatingOutModal';
import EntryEditor from './EntryEditor';
import HydrationTracker from './HydrationTracker';
import LogFoodModal, { type LogFoodInput } from './LogFoodModal';

type EditingEntry = { kind: 'food' | 'exercise' | 'hydration'; id: string } | null;

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to save this change. Please review the values and try again.';
}

export default function EnergyTracker() {
  const profile = useMealPlannerStore((state) => state.profile);
  const foodCatalog = useMealPlannerStore((state) => state.foodCatalog);
  const loggedFoods = useMealPlannerStore((state) => state.loggedFoods);
  const exerciseLogs = useMealPlannerStore((state) => state.exerciseLogs);
  const calorieAdjustmentPlan = useMealPlannerStore((state) => state.calorieAdjustmentPlan);
  const addExerciseLog = useMealPlannerStore((state) => state.addExerciseLog);
  const removeExerciseLog = useMealPlannerStore((state) => state.removeExerciseLog);
  const removeLoggedFood = useMealPlannerStore((state) => state.removeLoggedFood);
  const updateLoggedFoodCooking = useMealPlannerStore((state) => state.updateLoggedFoodCooking);
  const logFood = useMealPlannerStore((state) => state.logFood);
  const setCalorieAdjustmentPlan = useMealPlannerStore((state) => state.setCalorieAdjustmentPlan);
  const clearCalorieAdjustmentPlan = useMealPlannerStore((state) => state.clearCalorieAdjustmentPlan);

  const [selectedDate, setSelectedDate] = useState<DateKey>(() => localDateKey());
  const [activityName, setActivityName] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [caloriesBurned, setCaloriesBurned] = useState('');
  const [eatingOutOpen, setEatingOutOpen] = useState(false);
  const [logFoodOpen, setLogFoodOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<EditingEntry>(null);
  const [actionError, setActionError] = useState('');

  // The array selections intentionally trigger memo refreshes; the store methods are stable.
  const foodsForDate = useMemo(
    () => getFoodEntriesForDate(loggedFoods, selectedDate),
    [loggedFoods, selectedDate],
  );
  const exercisesForDate = useMemo(
    () => getExerciseEntriesForDate(exerciseLogs, selectedDate),
    [exerciseLogs, selectedDate],
  );
  const nutritionTotals = useMemo(
    () => calculateDailyNutritionTotals(loggedFoods, selectedDate, foodCatalog),
    [foodCatalog, loggedFoods, selectedDate],
  );
  const summary = useMemo(() => calculateMetabolicSummary(profile), [profile]);
  const adjustmentForDate = useMemo(
    () => getAdjustmentForDate(calorieAdjustmentPlan, selectedDate, summary.targetCalories),
    [calorieAdjustmentPlan, selectedDate, summary.targetCalories],
  );
  const adjustedTargetCalories = Math.max(0, summary.targetCalories - adjustmentForDate);
  const snapshot = useMemo(
    () => getEnergyBalanceSnapshot({
      date: selectedDate,
      targetCalorieGoal: adjustedTargetCalories,
      totalConsumedCalories: nutritionTotals.calories,
      exerciseLogs: exercisesForDate,
    }),
    [adjustedTargetCalories, exercisesForDate, nutritionTotals.calories, selectedDate],
  );
  const remainingPositive = snapshot.netCaloriesRemaining >= 0;

  const setTrackerDate = (value: string) => {
    if (!isDateKey(value)) {
      setActionError('Select a valid local calendar date to view or add tracker entries.');
      return;
    }
    setSelectedDate(value);
    setActionError('');
  };

  const handleAddExercise = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      addExerciseLog({
        activityName,
        durationMinutes: Number(durationMinutes),
        caloriesBurned: Number(caloriesBurned),
        dateKey: selectedDate,
      });
      setActivityName('');
      setDurationMinutes('');
      setCaloriesBurned('');
      setActionError('');
    } catch (error) {
      setActionError(messageFromError(error));
    }
  };

  const handleCookingUpdate = (
    id: string,
    cookingMethod: CookingMethod,
    oilType: OilType,
    oilAmount: number,
    oilUnit: 'tbsp' | 'tsp',
  ) => {
    try {
      updateLoggedFoodCooking(id, cookingMethod, oilType, oilAmount, oilUnit);
      setActionError('');
    } catch (error) {
      setActionError(messageFromError(error));
    }
  };

  const adjustmentRange = isDateKey(calorieAdjustmentPlan?.startDateKey) && isDateKey(calorieAdjustmentPlan?.endDateKey)
    ? `${calorieAdjustmentPlan.startDateKey} through ${calorieAdjustmentPlan.endDateKey}`
    : null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card title="Energy Balance" className="lg:col-span-2">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setLogFoodOpen(true)}
              className="rounded-lg bg-accent-green/90 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-accent-green/20 transition-colors hover:bg-accent-green"
            >
              + Log Food / Meal
            </button>
            <ScanBarcodeButton />
            <button
              type="button"
              onClick={() => setEatingOutOpen(true)}
              className="rounded-lg bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/10"
            >
              Eating Out
            </button>
          </div>
          <div>
            <label htmlFor="tracker-date" className="mb-1 block text-xs font-medium text-slate-400">Tracker date</label>
            <input
              id="tracker-date"
              type="date"
              value={selectedDate}
              onChange={(event) => setTrackerDate(event.target.value)}
              className="input w-auto"
            />
          </div>
        </div>

        {actionError && (
          <p role="alert" className="mt-4 rounded-xl bg-accent-red/15 px-3 py-2 text-sm text-accent-red">{actionError}</p>
        )}

        {calorieAdjustmentPlan && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-accent-amber/10 px-3 py-2 text-xs text-accent-amber">
            <span>
              {adjustmentRange
                ? `Restaurant adjustment scheduled ${adjustmentRange}. ${selectedDate}: ${adjustmentForDate > 0 ? `-${adjustmentForDate} kcal` : 'no adjustment'}.`
                : 'This legacy restaurant adjustment has no dated schedule and is not applied.'}
            </span>
            <button
              type="button"
              onClick={clearCalorieAdjustmentPlan}
              className="shrink-0 font-semibold hover:text-accent-red"
              aria-label="Clear restaurant adjustment schedule"
            >
              Clear
            </button>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatBox label="Target Goal" value={`${Math.round(snapshot.targetCalorieGoal)}`} />
          <StatBox label="Consumed" value={`${Math.round(snapshot.totalConsumedCalories)}`} />
          <StatBox label="Exercise Burned" value={`${Math.round(snapshot.totalExerciseCaloriesBurned)}`} />
          <StatBox
            label="Net Remaining"
            value={`${Math.round(snapshot.netCaloriesRemaining)}`}
            className={remainingPositive ? 'text-accent-green' : 'text-accent-red'}
          />
        </div>

        <div className="mt-3 grid grid-cols-3 gap-3">
          <StatBox label="Protein" value={`${Math.round(nutritionTotals.proteinGrams)}g`} />
          <StatBox label="Carbs" value={`${Math.round(nutritionTotals.carbGrams)}g`} />
          <StatBox label="Fat" value={`${Math.round(nutritionTotals.fatGrams)}g`} />
        </div>

        <div className="mt-6">
          <h4 className="mb-2 text-sm font-semibold text-slate-200">Logged Foods</h4>
          {foodsForDate.length === 0 ? (
            <p className="text-sm text-slate-500">No foods logged for {selectedDate}.</p>
          ) : (
            <ul className="space-y-2">
              {foodsForDate.map((entry) => {
                const food = foodCatalog.find((item) => item.id === entry.foodId);
                const nutrition = getEntryNutrition(entry, foodCatalog);
                const warnings = food ? getDietaryWarnings(food, profile) : [];
                const storedWarnings = (entry.dietaryWarnings ?? []).filter((label) => !warnings.some((warning) => warning.label === label));
                return (
                  <li key={entry.id} className="rounded-lg bg-white/5 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-200">
                        {entry.name} <span className="text-slate-500">({entry.portionMode})</span>
                        {entry.mealType && (
                          <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-accent">
                            {formatLabel(entry.mealType)}
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-accent-green">{nutrition.calories} kcal</span>
                        <button type="button" onClick={() => setEditingEntry({ kind: 'food', id: entry.id })} className="text-xs text-slate-400 hover:text-slate-100">
                          Edit
                        </button>
                        <button type="button" onClick={() => removeLoggedFood(entry.id)} className="text-xs text-slate-500 hover:text-accent-red">
                          Remove
                        </button>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      P{Math.round(nutrition.proteinGrams * 10) / 10}g · C{Math.round(nutrition.carbGrams * 10) / 10}g · F{Math.round(nutrition.fatGrams * 10) / 10}g
                      {entry.source ? ` · Source: ${formatLabel(entry.source)}` : ''}
                      {entry.dietaryVerification === 'unverified' ? ' · Dietary facts unverified' : ''}
                    </p>
                    {(warnings.length > 0 || storedWarnings.length > 0) && (
                      <div className="mt-1.5 space-y-1">
                        {warnings.map((warning) => (
                          <p key={warning.label} className={`rounded-md px-2 py-1 text-[11px] font-medium ${warning.severity === 'red' ? 'bg-accent-red/15 text-accent-red' : 'bg-accent-amber/15 text-accent-amber'}`}>
                            {warning.label}
                          </p>
                        ))}
                        {storedWarnings.map((warning) => (
                          <p key={warning} className="rounded-md bg-accent-amber/15 px-2 py-1 text-[11px] font-medium text-accent-amber">{warning}</p>
                        ))}
                      </div>
                    )}
                    {food ? (
                      <div className="mt-2">
                        <CookingMethodControls
                          cookingOptions={food.cookingOptions}
                          method={entry.cookingMethod}
                          onMethodChange={(method) => handleCookingUpdate(entry.id, method, entry.oilAddition?.oilType ?? 'olive_oil', entry.oilAddition?.amount ?? 0, entry.oilAddition?.unit ?? 'tbsp')}
                          oilType={entry.oilAddition?.oilType ?? 'olive_oil'}
                          onOilTypeChange={(oilType) => handleCookingUpdate(entry.id, entry.cookingMethod, oilType, entry.oilAddition?.amount ?? 0, entry.oilAddition?.unit ?? 'tbsp')}
                          oilAmount={entry.oilAddition?.amount ?? 0}
                          onOilAmountChange={(amount) => handleCookingUpdate(entry.id, entry.cookingMethod, entry.oilAddition?.oilType ?? 'olive_oil', amount, entry.oilAddition?.unit ?? 'tbsp')}
                          oilUnit={entry.oilAddition?.unit ?? 'tbsp'}
                          onOilUnitChange={(unit) => handleCookingUpdate(entry.id, entry.cookingMethod, entry.oilAddition?.oilType ?? 'olive_oil', entry.oilAddition?.amount ?? 0, unit)}
                          compact
                        />
                      </div>
                    ) : (
                      <p className="mt-1 text-xs text-slate-500">Cooking method: {formatLabel(entry.cookingMethod)}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Card>

      <Card title="Add Exercise">
        <form onSubmit={handleAddExercise} className="space-y-3" noValidate>
          <div>
            <label htmlFor="exercise-name" className="mb-1.5 block text-sm font-medium text-slate-300">Activity Name</label>
            <input id="exercise-name" className="input" value={activityName} onChange={(event) => setActivityName(event.target.value)} placeholder="e.g. Running" required />
          </div>
          <div>
            <label htmlFor="exercise-duration" className="mb-1.5 block text-sm font-medium text-slate-300">Duration (minutes)</label>
            <input id="exercise-duration" type="number" min="1" max="1440" step="1" className="input" value={durationMinutes} onChange={(event) => setDurationMinutes(event.target.value)} placeholder="30" required />
          </div>
          <div>
            <label htmlFor="exercise-burned" className="mb-1.5 block text-sm font-medium text-slate-300">Calories Burned</label>
            <input id="exercise-burned" type="number" min="0" max="20000" step="0.1" className="input" value={caloriesBurned} onChange={(event) => setCaloriesBurned(event.target.value)} placeholder="250" required />
          </div>
          <button type="submit" className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent/90">
            Add Exercise
          </button>
        </form>

        <div className="mt-5">
          <h4 className="mb-2 text-sm font-semibold text-slate-200">Exercise Log</h4>
          {exercisesForDate.length === 0 ? (
            <p className="text-sm text-slate-500">No exercises logged for {selectedDate}.</p>
          ) : (
            <ul className="space-y-2">
              {exercisesForDate.map((log) => (
                <li key={log.id} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm">
                  <span className="text-slate-200">
                    {log.activityName} <span className="text-slate-500">({log.durationMinutes} min)</span>
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-accent-amber">{log.caloriesBurned} kcal</span>
                    <button type="button" onClick={() => setEditingEntry({ kind: 'exercise', id: log.id })} className="text-xs text-slate-400 hover:text-slate-100">Edit</button>
                    <button type="button" onClick={() => removeExerciseLog(log.id)} className="text-xs text-slate-500 hover:text-accent-red">Remove</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <div className="lg:col-span-3">
        <HydrationTracker selectedDate={selectedDate} onSelectedDateChange={setTrackerDate} />
      </div>

      <EatingOutModal
        open={eatingOutOpen}
        onClose={() => setEatingOutOpen(false)}
        remainingCalories={snapshot.netCaloriesRemaining}
        onLogMeal={(item, adjustmentPlan) => {
          try {
            logFood(
              `restaurant-${item.id}-${crypto.randomUUID()}`,
              item.name,
              item.calories,
              'raw',
              'raw',
              undefined,
              'dinner',
              { proteinGrams: item.proteinGrams, carbGrams: item.carbGrams, fatGrams: item.fatGrams },
              { source: 'restaurant', portion: 'Restaurant menu item', dateKey: selectedDate },
            );
            if (adjustmentPlan) setCalorieAdjustmentPlan(adjustmentPlan);
            setActionError('');
            setEatingOutOpen(false);
          } catch (error) {
            setActionError(messageFromError(error));
          }
        }}
      />

      <LogFoodModal
        open={logFoodOpen}
        onClose={() => setLogFoodOpen(false)}
        onSave={(input: LogFoodInput) => {
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
              { source: input.source ?? 'manual', servings: input.servings ?? 1, portion: input.portion, dateKey: selectedDate },
            );
            setActionError('');
          } catch (error) {
            setActionError(messageFromError(error));
            throw error;
          }
        }}
      />

      {editingEntry && <EntryEditor kind={editingEntry.kind} id={editingEntry.id} onClose={() => setEditingEntry(null)} />}
    </div>
  );
}

function StatBox({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-xl bg-white/5 p-3 text-center">
      <div className={`text-xl font-bold text-slate-100 ${className}`}>{value}</div>
      <div className="mt-1 text-xs text-slate-400">{label}</div>
    </div>
  );
}
