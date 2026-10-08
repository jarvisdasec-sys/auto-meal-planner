'use client';

import { useEffect, useMemo, useState } from 'react';
import { entryDateKey, isDateKey, localDateKey, type DateKey } from '@/lib/dateKeys';
import type { MealWindow } from '@/lib/fitnessMealPlanner';
import { getEntryNutrition } from '@/lib/nutritionLedger';
import { useMealPlannerStore } from '@/store/useMealPlannerStore';
import Modal from './ui/Modal';

const MEAL_TYPES: Array<{ value: MealWindow; label: string }> = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snacks', label: 'Snack' },
];

export interface EntryEditorProps {
  kind: 'food' | 'exercise' | 'hydration';
  id: string;
  onClose: () => void;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unable to save this entry. Please review the values and try again.';
}

function requiredNumber(value: string, label: string): number {
  if (!value.trim()) throw new Error(`${label} is required.`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be a finite number.`);
  return parsed;
}

function requiredDate(value: string): DateKey {
  if (!isDateKey(value)) throw new Error('Date must be a valid local calendar date.');
  return value;
}

export default function EntryEditor({ kind, id, onClose }: EntryEditorProps) {
  const foodCatalog = useMealPlannerStore((state) => state.foodCatalog);
  const loggedFoods = useMealPlannerStore((state) => state.loggedFoods);
  const exerciseLogs = useMealPlannerStore((state) => state.exerciseLogs);
  const hydrationLogs = useMealPlannerStore((state) => state.hydrationLogs);
  const updateLoggedFood = useMealPlannerStore((state) => state.updateLoggedFood);
  const updateExerciseLog = useMealPlannerStore((state) => state.updateExerciseLog);
  const updateHydration = useMealPlannerStore((state) => state.updateHydration);

  const foodEntry = useMemo(
    () => (kind === 'food' ? loggedFoods.find((entry) => entry.id === id) : undefined),
    [id, kind, loggedFoods],
  );
  const exerciseEntry = useMemo(
    () => (kind === 'exercise' ? exerciseLogs.find((entry) => entry.id === id) : undefined),
    [exerciseLogs, id, kind],
  );
  const hydrationEntry = useMemo(
    () => (kind === 'hydration' ? hydrationLogs.find((entry) => entry.id === id) : undefined),
    [hydrationLogs, id, kind],
  );
  const foodNutrition = useMemo(
    () => (foodEntry ? getEntryNutrition(foodEntry, foodCatalog) : undefined),
    [foodCatalog, foodEntry],
  );

  const [foodForm, setFoodForm] = useState({
    name: '',
    calories: '',
    proteinGrams: '',
    carbGrams: '',
    fatGrams: '',
    mealType: '' as MealWindow | '',
    dateKey: localDateKey() as string,
  });
  const [exerciseForm, setExerciseForm] = useState({
    activityName: '',
    durationMinutes: '',
    caloriesBurned: '',
    dateKey: localDateKey() as string,
  });
  const [hydrationForm, setHydrationForm] = useState({ ounces: '', dateKey: localDateKey() as string });
  const [error, setError] = useState('');

  useEffect(() => {
    if (!foodEntry || kind !== 'food') return;
    setFoodForm({
      name: foodEntry.name,
      calories: String(foodNutrition?.calories ?? foodEntry.calories),
      proteinGrams: String(foodNutrition?.proteinGrams ?? 0),
      carbGrams: String(foodNutrition?.carbGrams ?? 0),
      fatGrams: String(foodNutrition?.fatGrams ?? 0),
      mealType: foodEntry.mealType ?? '',
      dateKey: entryDateKey(foodEntry) ?? localDateKey(),
    });
    setError('');
  }, [foodEntry, foodNutrition, kind]);

  useEffect(() => {
    if (!exerciseEntry || kind !== 'exercise') return;
    setExerciseForm({
      activityName: exerciseEntry.activityName,
      durationMinutes: String(exerciseEntry.durationMinutes),
      caloriesBurned: String(exerciseEntry.caloriesBurned),
      dateKey: entryDateKey(exerciseEntry) ?? localDateKey(),
    });
    setError('');
  }, [exerciseEntry, kind]);

  useEffect(() => {
    if (!hydrationEntry || kind !== 'hydration') return;
    setHydrationForm({
      ounces: String(hydrationEntry.ounces),
      dateKey: entryDateKey(hydrationEntry) ?? localDateKey(),
    });
    setError('');
  }, [hydrationEntry, kind]);

  const missingEntry = (kind === 'food' && !foodEntry)
    || (kind === 'exercise' && !exerciseEntry)
    || (kind === 'hydration' && !hydrationEntry);

  if (missingEntry) {
    return (
      <Modal open onClose={onClose} title="Entry unavailable">
        <p className="text-sm text-slate-300" role="alert">
          This entry is no longer available. It may have been removed in another view.
        </p>
        <button type="button" onClick={onClose} className="mt-4 w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90">
          Close
        </button>
      </Modal>
    );
  }

  const saveFood = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      updateLoggedFood(id, {
        name: foodForm.name,
        calories: requiredNumber(foodForm.calories, 'Calories'),
        proteinGrams: requiredNumber(foodForm.proteinGrams, 'Protein'),
        carbGrams: requiredNumber(foodForm.carbGrams, 'Carbs'),
        fatGrams: requiredNumber(foodForm.fatGrams, 'Fat'),
        mealType: foodForm.mealType || undefined,
        dateKey: requiredDate(foodForm.dateKey),
      });
      onClose();
    } catch (saveError) {
      setError(errorMessage(saveError));
    }
  };

  const saveExercise = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      updateExerciseLog(id, {
        activityName: exerciseForm.activityName,
        durationMinutes: requiredNumber(exerciseForm.durationMinutes, 'Exercise duration'),
        caloriesBurned: requiredNumber(exerciseForm.caloriesBurned, 'Calories burned'),
        dateKey: requiredDate(exerciseForm.dateKey),
      });
      onClose();
    } catch (saveError) {
      setError(errorMessage(saveError));
    }
  };

  const saveHydration = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      updateHydration(id, {
        ounces: requiredNumber(hydrationForm.ounces, 'Water amount'),
        dateKey: requiredDate(hydrationForm.dateKey),
      });
      onClose();
    } catch (saveError) {
      setError(errorMessage(saveError));
    }
  };

  if (kind === 'food') {
    return (
      <Modal open onClose={onClose} title="Edit food entry">
        <form onSubmit={saveFood} className="space-y-3" noValidate>
          <Field label="Food name" htmlFor="entry-food-name">
            <input id="entry-food-name" className="input" value={foodForm.name} onChange={(event) => setFoodForm({ ...foodForm, name: event.target.value })} required />
          </Field>
          <Field label="Meal type" htmlFor="entry-food-meal">
            <select id="entry-food-meal" className="input" value={foodForm.mealType} onChange={(event) => setFoodForm({ ...foodForm, mealType: event.target.value as MealWindow | '' })}>
              <option value="">Not specified</option>
              {MEAL_TYPES.map((meal) => <option key={meal.value} value={meal.value}>{meal.label}</option>)}
            </select>
          </Field>
          <Field label="Date" htmlFor="entry-food-date">
            <input id="entry-food-date" type="date" className="input" value={foodForm.dateKey} onChange={(event) => setFoodForm({ ...foodForm, dateKey: event.target.value })} required />
          </Field>
          <Field label="Calories (kcal)" htmlFor="entry-food-calories">
            <input id="entry-food-calories" type="number" min="0" step="0.1" className="input" value={foodForm.calories} onChange={(event) => setFoodForm({ ...foodForm, calories: event.target.value })} required />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Protein (g)" htmlFor="entry-food-protein">
              <input id="entry-food-protein" type="number" min="0" step="0.1" className="input" value={foodForm.proteinGrams} onChange={(event) => setFoodForm({ ...foodForm, proteinGrams: event.target.value })} required />
            </Field>
            <Field label="Carbs (g)" htmlFor="entry-food-carbs">
              <input id="entry-food-carbs" type="number" min="0" step="0.1" className="input" value={foodForm.carbGrams} onChange={(event) => setFoodForm({ ...foodForm, carbGrams: event.target.value })} required />
            </Field>
            <Field label="Fat (g)" htmlFor="entry-food-fat">
              <input id="entry-food-fat" type="number" min="0" step="0.1" className="input" value={foodForm.fatGrams} onChange={(event) => setFoodForm({ ...foodForm, fatGrams: event.target.value })} required />
            </Field>
          </div>
          <EditorActions error={error} onClose={onClose} />
        </form>
      </Modal>
    );
  }

  if (kind === 'exercise') {
    return (
      <Modal open onClose={onClose} title="Edit exercise entry">
        <form onSubmit={saveExercise} className="space-y-3" noValidate>
          <Field label="Activity name" htmlFor="entry-exercise-name">
            <input id="entry-exercise-name" className="input" value={exerciseForm.activityName} onChange={(event) => setExerciseForm({ ...exerciseForm, activityName: event.target.value })} required />
          </Field>
          <Field label="Date" htmlFor="entry-exercise-date">
            <input id="entry-exercise-date" type="date" className="input" value={exerciseForm.dateKey} onChange={(event) => setExerciseForm({ ...exerciseForm, dateKey: event.target.value })} required />
          </Field>
          <Field label="Duration (minutes)" htmlFor="entry-exercise-duration">
            <input id="entry-exercise-duration" type="number" min="1" step="1" className="input" value={exerciseForm.durationMinutes} onChange={(event) => setExerciseForm({ ...exerciseForm, durationMinutes: event.target.value })} required />
          </Field>
          <Field label="Calories burned" htmlFor="entry-exercise-burned">
            <input id="entry-exercise-burned" type="number" min="0" step="0.1" className="input" value={exerciseForm.caloriesBurned} onChange={(event) => setExerciseForm({ ...exerciseForm, caloriesBurned: event.target.value })} required />
          </Field>
          <EditorActions error={error} onClose={onClose} />
        </form>
      </Modal>
    );
  }

  return (
    <Modal open onClose={onClose} title="Edit hydration entry">
      <form onSubmit={saveHydration} className="space-y-3" noValidate>
        <Field label="Date" htmlFor="entry-hydration-date">
          <input id="entry-hydration-date" type="date" className="input" value={hydrationForm.dateKey} onChange={(event) => setHydrationForm({ ...hydrationForm, dateKey: event.target.value })} required />
        </Field>
        <Field label="Water amount (oz)" htmlFor="entry-hydration-ounces">
          <input id="entry-hydration-ounces" type="number" min="0.1" max="640" step="0.1" className="input" value={hydrationForm.ounces} onChange={(event) => setHydrationForm({ ...hydrationForm, ounces: event.target.value })} required />
        </Field>
        <EditorActions error={error} onClose={onClose} />
      </form>
    </Modal>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-slate-300">{label}</label>
      {children}
    </div>
  );
}

function EditorActions({ error, onClose }: { error: string; onClose: () => void }) {
  return (
    <>
      {error && <p role="alert" className="rounded-lg bg-accent-red/15 px-3 py-2 text-sm text-accent-red">{error}</p>}
      <div className="flex gap-2 pt-2">
        <button type="submit" className="flex-1 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90">
          Save changes
        </button>
        <button type="button" onClick={onClose} className="rounded-lg bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/10">
          Cancel
        </button>
      </div>
    </>
  );
}
