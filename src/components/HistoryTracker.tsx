'use client';

import { useMemo, useState } from 'react';
import { useMealPlannerStore } from '@/store/useMealPlannerStore';
import Card from './ui/Card';

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

export default function HistoryTracker() {
  const loggedFoods = useMealPlannerStore((s) => s.loggedFoods);
  const exerciseLogs = useMealPlannerStore((s) => s.exerciseLogs);
  const foodCatalog = useMealPlannerStore((s) => s.foodCatalog);
  const [selectedDate, setSelectedDate] = useState(todayIso());

  const dailySummary = useMemo(() => {
    const foodsForDay = loggedFoods.filter((entry) => entry.timestamp.slice(0, 10) === selectedDate);
    const exercisesForDay = exerciseLogs.filter((log) => log.timestamp.slice(0, 10) === selectedDate);

    const caloriesConsumed = foodsForDay.reduce((total, entry) => total + entry.calories, 0);
    const caloriesBurned = exercisesForDay.reduce((total, log) => total + log.caloriesBurned, 0);
    const proteinConsumedGrams = foodsForDay.reduce((total, entry) => {
      const food = foodCatalog.find((f) => f.id === entry.foodId);
      return total + (food?.proteinGrams ?? 0);
    }, 0);
    const workoutSummary =
      exercisesForDay.length > 0 ? exercisesForDay.map((log) => log.activityName).join(', ') : 'No workout logged';

    return {
      caloriesConsumed,
      caloriesBurned,
      proteinConsumedGrams: Math.round(proteinConsumedGrams * 10) / 10,
      workoutSummary,
      mealsLogged: foodsForDay.length,
    };
  }, [loggedFoods, exerciseLogs, foodCatalog, selectedDate]);

  return (
    <Card title="Daily Log Calendar" subtitle="Select a day to view logged meals and workouts">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="text-sm text-slate-400">Date Selected</span>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="input w-auto"
        />
      </div>

      <div className="space-y-3 rounded-xl border border-surface-border bg-white/5 p-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <span className="block text-xs text-slate-400">Calories Consumed</span>
            <span className="text-lg font-bold text-accent">{dailySummary.caloriesConsumed} kcal</span>
          </div>
          <div>
            <span className="block text-xs text-slate-400">Protein Consumed</span>
            <span className="text-lg font-bold text-accent-green">{dailySummary.proteinConsumedGrams} g</span>
          </div>
          <div>
            <span className="block text-xs text-slate-400">Calories Burned</span>
            <span className="text-lg font-bold text-accent-amber">{dailySummary.caloriesBurned} kcal</span>
          </div>
        </div>
        <div className="border-t border-surface-border pt-3">
          <span className="block text-xs text-slate-400">Workout Session</span>
          <span className="text-sm font-medium text-slate-100">{dailySummary.workoutSummary}</span>
        </div>
        <div className="flex items-center justify-between border-t border-surface-border pt-3 text-xs text-slate-400">
          <span>Meals Logged</span>
          <span className="font-semibold text-slate-200">{dailySummary.mealsLogged}</span>
        </div>
      </div>
    </Card>
  );
}
