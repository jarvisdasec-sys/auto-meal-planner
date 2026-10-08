'use client';

import { useEffect, useState } from 'react';
import Modal from './ui/Modal';
import type { MealWindow } from '@/lib/fitnessMealPlanner';
import { assertRequiredName, validateNutrition, validateServings } from '@/lib/mealPlannerValidation';

export interface LogFoodInput {
  name: string;
  mealType: MealWindow;
  /** Final values after applying `servings` to the entered per-serving nutrition. */
  calories: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
  /** Optional addition for callers that persist serving metadata. Existing callbacks may ignore it safely. */
  servings?: number;
  portion?: string;
  source?: 'manual';
}

interface LogFoodModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (input: LogFoodInput) => void;
}

const MEAL_TYPES: { value: MealWindow; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snacks', label: 'Snack' },
];

function requiredNumber(value: string, field: string): number {
  if (!value.trim()) throw new Error(`${field} is required.`);
  return Number(value);
}

function optionalNumber(value: string): number {
  return value.trim() ? Number(value) : 0;
}

export default function LogFoodModal({ open, onClose, onSave }: LogFoodModalProps) {
  const [name, setName] = useState('');
  const [mealType, setMealType] = useState<MealWindow>('breakfast');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [servings, setServings] = useState('1');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setName('');
      setMealType('breakfast');
      setCalories('');
      setProtein('');
      setCarbs('');
      setFat('');
      setServings('1');
      setError(null);
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsedServings = validateServings(requiredNumber(servings, 'Servings'));
      const nutrition = validateNutrition({
        calories: requiredNumber(calories, 'Calories'),
        proteinGrams: optionalNumber(protein),
        carbGrams: optionalNumber(carbs),
        fatGrams: optionalNumber(fat),
      });
      const input: LogFoodInput = {
        name: assertRequiredName(name, 'Food / meal name'),
        mealType,
        calories: nutrition.calories * parsedServings,
        proteinGrams: nutrition.proteinGrams * parsedServings,
        carbGrams: nutrition.carbGrams * parsedServings,
        fatGrams: nutrition.fatGrams * parsedServings,
        servings: parsedServings,
        portion: `${parsedServings} serving${parsedServings === 1 ? '' : 's'}`,
        source: 'manual',
      };
      onSave(input);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to log this food. Please check the values and try again.');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Log Food / Meal">
      <form onSubmit={handleSubmit} className="space-y-3" noValidate>
        {error && <p id="manual-food-error" role="alert" className="rounded-lg bg-accent-red/10 px-3 py-2 text-sm text-accent-red">{error}</p>}
        <div>
          <label htmlFor="manual-food-name" className="mb-1.5 block text-sm font-medium text-slate-300">Food / Meal Name</label>
          <input
            id="manual-food-name"
            className="input"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(null); }}
            placeholder="e.g. Grilled Chicken & Rice"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'manual-food-error' : undefined}
          />
        </div>
        <div>
          <label htmlFor="manual-food-meal" className="mb-1.5 block text-sm font-medium text-slate-300">Meal Type</label>
          <select id="manual-food-meal" className="input" value={mealType} onChange={(e) => setMealType(e.target.value as MealWindow)}>
            {MEAL_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="manual-food-calories" className="mb-1.5 block text-sm font-medium text-slate-300">Calories per serving (kcal)</label>
            <input id="manual-food-calories" type="number" min="0" max="10000" step="any" inputMode="decimal" className="input" value={calories} onChange={(e) => { setCalories(e.target.value); setError(null); }} aria-invalid={Boolean(error)} />
          </div>
          <div>
            <label htmlFor="manual-food-servings" className="mb-1.5 block text-sm font-medium text-slate-300">Servings to log</label>
            <input id="manual-food-servings" type="number" min="0.01" max="100" step="0.25" inputMode="decimal" className="input" value={servings} onChange={(e) => { setServings(e.target.value); setError(null); }} aria-invalid={Boolean(error)} />
          </div>
        </div>
        <p className="-mt-1 text-xs text-slate-500">Nutrition is multiplied by the number of servings before it is logged. Zero-calorie foods are allowed.</p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="manual-food-protein" className="mb-1.5 block text-sm font-medium text-slate-300">Protein (g)</label>
            <input id="manual-food-protein" type="number" min="0" max="2000" step="any" inputMode="decimal" className="input" value={protein} onChange={(e) => { setProtein(e.target.value); setError(null); }} aria-invalid={Boolean(error)} />
          </div>
          <div>
            <label htmlFor="manual-food-carbs" className="mb-1.5 block text-sm font-medium text-slate-300">Carbs (g)</label>
            <input id="manual-food-carbs" type="number" min="0" max="2000" step="any" inputMode="decimal" className="input" value={carbs} onChange={(e) => { setCarbs(e.target.value); setError(null); }} aria-invalid={Boolean(error)} />
          </div>
          <div>
            <label htmlFor="manual-food-fat" className="mb-1.5 block text-sm font-medium text-slate-300">Fat (g)</label>
            <input id="manual-food-fat" type="number" min="0" max="2000" step="any" inputMode="decimal" className="input" value={fat} onChange={(e) => { setFat(e.target.value); setError(null); }} aria-invalid={Boolean(error)} />
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <button type="submit" className="flex-1 rounded-lg bg-accent-green/90 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-green">Log Food</button>
          <button type="button" onClick={onClose} className="rounded-lg bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/10">Cancel</button>
        </div>
      </form>
    </Modal>
  );
}
