'use client';

import { useMemo, useState } from 'react';
import { useMealPlannerStore } from '@/store/useMealPlannerStore';
import { calculateMetabolicSummary, getDietaryWarnings, getEnergyBalanceSnapshot } from '@/lib/fitnessMealPlanner';
import { formatLabel } from '@/lib/format';
import Card from './ui/Card';
import ScanBarcodeButton from './ScanBarcodeButton';
import CookingMethodControls from './CookingMethodControls';
import EatingOutModal from './EatingOutModal';
import HydrationTracker from './HydrationTracker';
import LogFoodModal, { type LogFoodInput } from './LogFoodModal';

export default function EnergyTracker() {
  const profile = useMealPlannerStore((s) => s.profile);
  const foodCatalog = useMealPlannerStore((s) => s.foodCatalog);
  const exerciseLogs = useMealPlannerStore((s) => s.exerciseLogs);
  const loggedFoods = useMealPlannerStore((s) => s.loggedFoods);
  const addExerciseLog = useMealPlannerStore((s) => s.addExerciseLog);
  const removeExerciseLog = useMealPlannerStore((s) => s.removeExerciseLog);
  const removeLoggedFood = useMealPlannerStore((s) => s.removeLoggedFood);
  const updateLoggedFoodCooking = useMealPlannerStore((s) => s.updateLoggedFoodCooking);
  const logFood = useMealPlannerStore((s) => s.logFood);
  const calorieAdjustmentPlan = useMealPlannerStore((s) => s.calorieAdjustmentPlan);
  const setCalorieAdjustmentPlan = useMealPlannerStore((s) => s.setCalorieAdjustmentPlan);
  const clearCalorieAdjustmentPlan = useMealPlannerStore((s) => s.clearCalorieAdjustmentPlan);
  const totalConsumedCalories = useMealPlannerStore((s) => s.totalConsumedCalories());

  const [activityName, setActivityName] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [caloriesBurned, setCaloriesBurned] = useState('');
  const [eatingOutOpen, setEatingOutOpen] = useState(false);
  const [logFoodOpen, setLogFoodOpen] = useState(false);

  const summary = useMemo(() => calculateMetabolicSummary(profile), [profile]);
  const adjustedTargetCalories = summary.targetCalories - (calorieAdjustmentPlan?.dailyOffset ?? 0);

  const todayMacros = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return loggedFoods
      .filter((entry) => entry.timestamp.slice(0, 10) === today)
      .reduce(
        (totals, entry) => {
          const food = foodCatalog.find((f) => f.id === entry.foodId);
          return {
            proteinGrams: totals.proteinGrams + (entry.proteinGrams ?? food?.proteinGrams ?? 0),
            carbGrams: totals.carbGrams + (entry.carbGrams ?? food?.carbGrams ?? 0),
            fatGrams: totals.fatGrams + (entry.fatGrams ?? food?.fatGrams ?? 0),
          };
        },
        { proteinGrams: 0, carbGrams: 0, fatGrams: 0 },
      );
  }, [loggedFoods, foodCatalog]);

  const snapshot = useMemo(
    () =>
      getEnergyBalanceSnapshot({
        date: new Date().toISOString().slice(0, 10),
        targetCalorieGoal: adjustedTargetCalories,
        totalConsumedCalories,
        exerciseLogs,
      }),
    [adjustedTargetCalories, totalConsumedCalories, exerciseLogs],
  );

  const handleAddExercise = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activityName || !durationMinutes || !caloriesBurned) return;
    addExerciseLog({
      activityName,
      durationMinutes: Number(durationMinutes),
      caloriesBurned: Number(caloriesBurned),
    });
    setActivityName('');
    setDurationMinutes('');
    setCaloriesBurned('');
  };

  const remainingPositive = snapshot.netCaloriesRemaining >= 0;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card title="Energy Balance" className="lg:col-span-2">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setLogFoodOpen(true)}
            className="rounded-lg bg-accent-green/90 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-accent-green/20 transition-colors hover:bg-accent-green"
          >
            + Log Food / Meal
          </button>
          <ScanBarcodeButton />
          <button
            onClick={() => setEatingOutOpen(true)}
            className="rounded-lg bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/10"
          >
            Eating Out
          </button>
        </div>

        {calorieAdjustmentPlan && (
          <div className="mt-4 flex items-center justify-between rounded-xl bg-accent-amber/10 px-3 py-2 text-xs text-accent-amber">
            <span>
              Smooth Adjustment active: -{calorieAdjustmentPlan.dailyOffset} kcal/day for {calorieAdjustmentPlan.daysToSpread}{' '}
              days (from a {calorieAdjustmentPlan.excessCalories} kcal restaurant overage).
            </span>
            <button onClick={clearCalorieAdjustmentPlan} className="ml-3 shrink-0 font-semibold hover:text-accent-red">
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
          <StatBox label="Protein Today" value={`${Math.round(todayMacros.proteinGrams)}g`} />
          <StatBox label="Carbs Today" value={`${Math.round(todayMacros.carbGrams)}g`} />
          <StatBox label="Fat Today" value={`${Math.round(todayMacros.fatGrams)}g`} />
        </div>

        <div className="mt-6">
          <h4 className="mb-2 text-sm font-semibold text-slate-200">Logged Foods</h4>
          {loggedFoods.length === 0 ? (
            <p className="text-sm text-slate-500">No foods logged yet — log food from the Meal Plan tab.</p>
          ) : (
            <ul className="space-y-2">
              {loggedFoods.map((entry) => {
                const food = foodCatalog.find((f) => f.id === entry.foodId);
                const warnings = food ? getDietaryWarnings(food, profile) : [];
                return (
                  <li key={entry.id} className="rounded-lg bg-white/5 px-3 py-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-200">
                        {entry.name} <span className="text-slate-500">({entry.portionMode})</span>
                        {entry.mealType && (
                          <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-accent">
                            {formatLabel(entry.mealType)}
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-accent-green">{entry.calories} kcal</span>
                        <button
                          onClick={() => removeLoggedFood(entry.id)}
                          className="text-xs text-slate-500 hover:text-accent-red"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    {warnings.length > 0 && (
                      <div className="mt-1.5 space-y-1">
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
                      </div>
                    )}
                    {food ? (
                      <div className="mt-2">
                        <CookingMethodControls
                          cookingOptions={food.cookingOptions}
                          method={entry.cookingMethod}
                          onMethodChange={(method) =>
                            updateLoggedFoodCooking(
                              entry.id,
                              method,
                              entry.oilAddition?.oilType ?? 'olive_oil',
                              entry.oilAddition?.amount ?? 1,
                              entry.oilAddition?.unit ?? 'tbsp',
                            )
                          }
                          oilType={entry.oilAddition?.oilType ?? 'olive_oil'}
                          onOilTypeChange={(oilType) =>
                            updateLoggedFoodCooking(
                              entry.id,
                              entry.cookingMethod,
                              oilType,
                              entry.oilAddition?.amount ?? 1,
                              entry.oilAddition?.unit ?? 'tbsp',
                            )
                          }
                          oilAmount={entry.oilAddition?.amount ?? 1}
                          onOilAmountChange={(amount) =>
                            updateLoggedFoodCooking(
                              entry.id,
                              entry.cookingMethod,
                              entry.oilAddition?.oilType ?? 'olive_oil',
                              amount,
                              entry.oilAddition?.unit ?? 'tbsp',
                            )
                          }
                          oilUnit={entry.oilAddition?.unit ?? 'tbsp'}
                          onOilUnitChange={(unit) =>
                            updateLoggedFoodCooking(
                              entry.id,
                              entry.cookingMethod,
                              entry.oilAddition?.oilType ?? 'olive_oil',
                              entry.oilAddition?.amount ?? 1,
                              unit,
                            )
                          }
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
        <form onSubmit={handleAddExercise} className="space-y-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">Activity Name</label>
            <input
              className="input"
              value={activityName}
              onChange={(e) => setActivityName(e.target.value)}
              placeholder="e.g. Running"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">Duration (minutes)</label>
            <input
              type="number"
              className="input"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              placeholder="30"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">Calories Burned</label>
            <input
              type="number"
              className="input"
              value={caloriesBurned}
              onChange={(e) => setCaloriesBurned(e.target.value)}
              placeholder="250"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent/90"
          >
            Add Exercise
          </button>
        </form>

        <div className="mt-5">
          <h4 className="mb-2 text-sm font-semibold text-slate-200">Exercise Log</h4>
          {exerciseLogs.length === 0 ? (
            <p className="text-sm text-slate-500">No exercises logged yet.</p>
          ) : (
            <ul className="space-y-2">
              {exerciseLogs.map((log) => (
                <li
                  key={log.id}
                  className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm"
                >
                  <span className="text-slate-200">
                    {log.activityName} <span className="text-slate-500">({log.durationMinutes} min)</span>
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-accent-amber">{log.caloriesBurned} kcal</span>
                    <button
                      onClick={() => removeExerciseLog(log.id)}
                      className="text-xs text-slate-500 hover:text-accent-red"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <div className="lg:col-span-3">
        <HydrationTracker />
      </div>

      <EatingOutModal
        open={eatingOutOpen}
        onClose={() => setEatingOutOpen(false)}
        remainingCalories={snapshot.netCaloriesRemaining}
        onLogMeal={(item, adjustmentPlan) => {
          logFood(`restaurant-${item.id}-${crypto.randomUUID()}`, item.name, item.calories, 'raw', 'raw');
          if (adjustmentPlan) setCalorieAdjustmentPlan(adjustmentPlan);
          setEatingOutOpen(false);
        }}
      />

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

function StatBox({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-xl bg-white/5 p-3 text-center">
      <div className={`text-xl font-bold text-slate-100 ${className}`}>{value}</div>
      <div className="mt-1 text-xs text-slate-400">{label}</div>
    </div>
  );
}
