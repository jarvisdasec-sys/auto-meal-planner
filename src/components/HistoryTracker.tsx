'use client';

import { useMemo, useState } from 'react';
import EntryEditor from '@/components/EntryEditor';
import { entryDateKey, isDateKey, localDateKey, type DateKey } from '@/lib/dateKeys';
import {
  calculateDailyNutritionTotals,
  getEntryNutrition,
  getExerciseEntriesForDate,
  getFoodEntriesForDate,
  getHydrationEntriesForDate,
} from '@/lib/nutritionLedger';
import { useMealPlannerStore } from '@/store/useMealPlannerStore';
import Card from './ui/Card';

type EditableEntry = {
  kind: 'food' | 'exercise' | 'hydration';
  id: string;
};

function formatNumber(value: number, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(value);
}

function titleCase(value?: string): string {
  if (!value) return 'Meal';
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function entryDateDescription(record: { dateKey?: string; timestamp?: string }): string {
  const dateKey = entryDateKey(record);
  return dateKey ? `Logged for ${dateKey}` : 'Date unavailable for this legacy entry';
}

export default function HistoryTracker() {
  const loggedFoods = useMealPlannerStore((state) => state.loggedFoods);
  const exerciseLogs = useMealPlannerStore((state) => state.exerciseLogs);
  const hydrationLogs = useMealPlannerStore((state) => state.hydrationLogs);
  const foodCatalog = useMealPlannerStore((state) => state.foodCatalog);
  const removeLoggedFood = useMealPlannerStore((state) => state.removeLoggedFood);
  const removeExerciseLog = useMealPlannerStore((state) => state.removeExerciseLog);
  const removeHydration = useMealPlannerStore((state) => state.removeHydration);
  const [selectedDate, setSelectedDate] = useState<DateKey>(() => localDateKey());
  const [dateError, setDateError] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<EditableEntry | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const day = useMemo(() => {
    const foods = getFoodEntriesForDate(loggedFoods, selectedDate)
      .slice()
      .sort((left, right) => right.timestamp.localeCompare(left.timestamp));
    const exercises = getExerciseEntriesForDate(exerciseLogs, selectedDate)
      .slice()
      .sort((left, right) => right.timestamp.localeCompare(left.timestamp));
    const hydration = getHydrationEntriesForDate(hydrationLogs, selectedDate)
      .slice()
      .sort((left, right) => right.timestamp.localeCompare(left.timestamp));

    return {
      foods,
      exercises,
      hydration,
      nutrition: calculateDailyNutritionTotals(loggedFoods, selectedDate, foodCatalog),
      caloriesBurned: exercises.reduce((total, exercise) => total + exercise.caloriesBurned, 0),
    };
  }, [exerciseLogs, foodCatalog, hydrationLogs, loggedFoods, selectedDate]);

  const handleDateChange = (value: string) => {
    if (!value) {
      setDateError('Choose a calendar date to view a log.');
      return;
    }
    if (!isDateKey(value)) {
      setDateError('Enter a valid calendar date in YYYY-MM-DD format.');
      return;
    }

    setSelectedDate(value);
    setDateError(null);
    setActionMessage(null);
  };

  const closeEditor = () => {
    setEditingEntry(null);
  };

  const removeFood = (id: string, name: string) => {
    removeLoggedFood(id);
    setActionMessage(`Removed ${name} from ${selectedDate}.`);
  };

  const removeExercise = (id: string, name: string) => {
    removeExerciseLog(id);
    setActionMessage(`Removed ${name} from ${selectedDate}.`);
  };

  const removeWater = (id: string, ounces: number) => {
    removeHydration(id);
    setActionMessage(`Removed ${formatNumber(ounces)} oz of hydration from ${selectedDate}.`);
  };

  const isEmpty = day.foods.length === 0 && day.exercises.length === 0 && day.hydration.length === 0;

  return (
    <Card title="Daily Log Calendar" subtitle="Review actual meals, workouts, and hydration logged for one local calendar day.">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <label htmlFor="history-date" className="mb-1 block text-sm text-slate-400">Date selected</label>
          <input
            id="history-date"
            type="date"
            value={selectedDate}
            onChange={(event) => handleDateChange(event.target.value)}
            aria-describedby={dateError ? 'history-date-error' : undefined}
            aria-invalid={Boolean(dateError)}
            className="input w-auto"
          />
          {dateError && (
            <p id="history-date-error" role="alert" className="mt-1 text-xs text-accent-red">
              {dateError}
            </p>
          )}
        </div>
        <p className="max-w-md text-xs text-slate-400">
          Planned meals are recommendations only and are not counted here. Totals include only items actually logged on {selectedDate}.
        </p>
      </div>

      {actionMessage && (
        <p role="status" className="mb-4 rounded-lg border border-accent-green/30 bg-accent-green/10 px-3 py-2 text-sm text-accent-green">
          {actionMessage}
        </p>
      )}

      <div className="space-y-3 rounded-xl border border-surface-border bg-white/5 p-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
          <SummaryMetric label="Calories consumed" value={`${formatNumber(day.nutrition.calories, 0)} kcal`} tone="text-accent" />
          <SummaryMetric label="Protein" value={`${formatNumber(day.nutrition.proteinGrams)} g`} tone="text-accent-green" />
          <SummaryMetric label="Carbs" value={`${formatNumber(day.nutrition.carbGrams)} g`} tone="text-slate-100" />
          <SummaryMetric label="Fat" value={`${formatNumber(day.nutrition.fatGrams)} g`} tone="text-slate-100" />
          <SummaryMetric label="Calories burned" value={`${formatNumber(day.caloriesBurned, 0)} kcal`} tone="text-accent-amber" />
        </div>
        <div className="flex items-center justify-between border-t border-surface-border pt-3 text-xs text-slate-400">
          <span>Meals logged</span>
          <span className="font-semibold text-slate-200">{day.nutrition.entryCount}</span>
        </div>
      </div>

      {isEmpty ? (
        <div className="mt-4 rounded-xl border border-dashed border-surface-border bg-white/[0.03] p-5 text-sm text-slate-400">
          Nothing has been logged for {selectedDate}. Add a meal, workout, or hydration entry from the Live Calorie Tracker to see it here.
        </div>
      ) : (
        <div className="mt-4 grid gap-4 xl:grid-cols-3">
          <section aria-labelledby="history-meals-heading" className="rounded-xl border border-surface-border bg-white/[0.03] p-4">
            <h4 id="history-meals-heading" className="text-sm font-semibold text-slate-100">Logged meals</h4>
            {day.foods.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No meals were logged for this day.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {day.foods.map((entry) => {
                  const nutrition = getEntryNutrition(entry, foodCatalog);
                  return (
                    <li key={entry.id} className="rounded-lg border border-surface-border bg-surface-card/60 p-3">
                      <div className="flex gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-slate-100">{entry.name}</p>
                          <p className="mt-0.5 text-xs text-slate-400">
                            {titleCase(entry.mealType)} · {entry.portion ?? `${entry.servings ?? 1} serving${(entry.servings ?? 1) === 1 ? '' : 's'}`}
                          </p>
                          <p className="mt-1 text-xs text-slate-300">
                            {formatNumber(nutrition.calories, 0)} kcal · P {formatNumber(nutrition.proteinGrams)} g · C {formatNumber(nutrition.carbGrams)} g · F {formatNumber(nutrition.fatGrams)} g
                          </p>
                          <p className="mt-1 text-xs text-slate-500">{entryDateDescription(entry)}</p>
                        </div>
                        <EntryActions
                          editLabel={`Edit logged meal ${entry.name}`}
                          removeLabel={`Remove logged meal ${entry.name}`}
                          onEdit={() => setEditingEntry({ kind: 'food', id: entry.id })}
                          onRemove={() => removeFood(entry.id, entry.name)}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section aria-labelledby="history-workouts-heading" className="rounded-xl border border-surface-border bg-white/[0.03] p-4">
            <h4 id="history-workouts-heading" className="text-sm font-semibold text-slate-100">Logged workouts</h4>
            {day.exercises.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No workouts were logged for this day.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {day.exercises.map((exercise) => (
                  <li key={exercise.id} className="rounded-lg border border-surface-border bg-surface-card/60 p-3">
                    <div className="flex gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-slate-100">{exercise.activityName}</p>
                        <p className="mt-1 text-xs text-slate-300">
                          {formatNumber(exercise.durationMinutes, 0)} min · {formatNumber(exercise.caloriesBurned, 0)} kcal burned
                        </p>
                        <p className="mt-1 text-xs text-slate-500">{entryDateDescription(exercise)}</p>
                      </div>
                      <EntryActions
                        editLabel={`Edit workout ${exercise.activityName}`}
                        removeLabel={`Remove workout ${exercise.activityName}`}
                        onEdit={() => setEditingEntry({ kind: 'exercise', id: exercise.id })}
                        onRemove={() => removeExercise(exercise.id, exercise.activityName)}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="history-hydration-heading" className="rounded-xl border border-surface-border bg-white/[0.03] p-4">
            <h4 id="history-hydration-heading" className="text-sm font-semibold text-slate-100">Hydration</h4>
            {day.hydration.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">No hydration was logged for this day.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {day.hydration.map((entry) => (
                  <li key={entry.id} className="rounded-lg border border-surface-border bg-surface-card/60 p-3">
                    <div className="flex gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-100">{formatNumber(entry.ounces)} oz water</p>
                        <p className="mt-1 text-xs text-slate-500">{entryDateDescription(entry)}</p>
                      </div>
                      <EntryActions
                        editLabel={`Edit ${formatNumber(entry.ounces)} ounces of hydration`}
                        removeLabel={`Remove ${formatNumber(entry.ounces)} ounces of hydration`}
                        onEdit={() => setEditingEntry({ kind: 'hydration', id: entry.id })}
                        onRemove={() => removeWater(entry.id, entry.ounces)}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {editingEntry && <EntryEditor kind={editingEntry.kind} id={editingEntry.id} onClose={closeEditor} />}
    </Card>
  );
}

function SummaryMetric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div>
      <span className="block text-xs text-slate-400">{label}</span>
      <span className={`text-lg font-bold ${tone}`}>{value}</span>
    </div>
  );
}

function EntryActions({
  editLabel,
  removeLabel,
  onEdit,
  onRemove,
}: {
  editLabel: string;
  removeLabel: string;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <button type="button" onClick={onEdit} aria-label={editLabel} className="text-xs font-medium text-accent hover:text-accent/80">
        Edit
      </button>
      <button type="button" onClick={onRemove} aria-label={removeLabel} className="text-xs text-slate-400 hover:text-accent-red">
        Remove
      </button>
    </div>
  );
}
