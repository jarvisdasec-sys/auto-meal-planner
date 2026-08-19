'use client';

import { useMemo, useState } from 'react';
import { useMealPlannerStore } from '@/store/useMealPlannerStore';
import { calculateMetabolicSummary, getEnergyBalanceSnapshot } from '@/lib/fitnessMealPlanner';
import Card from './ui/Card';
import ScanBarcodeButton from './ScanBarcodeButton';

export default function EnergyTracker() {
  const profile = useMealPlannerStore((s) => s.profile);
  const exerciseLogs = useMealPlannerStore((s) => s.exerciseLogs);
  const loggedFoods = useMealPlannerStore((s) => s.loggedFoods);
  const addExerciseLog = useMealPlannerStore((s) => s.addExerciseLog);
  const removeExerciseLog = useMealPlannerStore((s) => s.removeExerciseLog);
  const removeLoggedFood = useMealPlannerStore((s) => s.removeLoggedFood);
  const totalConsumedCalories = useMealPlannerStore((s) => s.totalConsumedCalories());

  const [activityName, setActivityName] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [caloriesBurned, setCaloriesBurned] = useState('');

  const summary = useMemo(() => calculateMetabolicSummary(profile), [profile]);

  const snapshot = useMemo(
    () =>
      getEnergyBalanceSnapshot({
        date: new Date().toISOString().slice(0, 10),
        targetCalorieGoal: summary.targetCalories,
        totalConsumedCalories,
        exerciseLogs,
      }),
    [summary.targetCalories, totalConsumedCalories, exerciseLogs],
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
        <ScanBarcodeButton />
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

        <div className="mt-6">
          <h4 className="mb-2 text-sm font-semibold text-slate-200">Logged Foods</h4>
          {loggedFoods.length === 0 ? (
            <p className="text-sm text-slate-500">No foods logged yet — log food from the Meal Plan tab.</p>
          ) : (
            <ul className="space-y-2">
              {loggedFoods.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm"
                >
                  <span className="text-slate-200">
                    {entry.name} <span className="text-slate-500">({entry.portionMode})</span>
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
                </li>
              ))}
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
