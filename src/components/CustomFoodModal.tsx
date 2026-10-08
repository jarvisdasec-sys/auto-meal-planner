'use client';

import { useEffect, useState } from 'react';
import Modal from './ui/Modal';
import type { FoodCategory } from '@/lib/foodCatalog';
import type { MealWindow } from '@/lib/fitnessMealPlanner';
import { assertRequiredName, validateNutrition, validateServings } from '@/lib/mealPlannerValidation';

export interface CustomFoodInput {
  name: string;
  /** Per-serving nutrition. Consumers should use `nutritionIsPerServing` when logging. */
  calories: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
  saveToCatalog: boolean;
  category: FoodCategory;
  mealWindow: MealWindow;
  /** Optional addition; one remains the default for existing consumers. */
  servings?: number;
  nutritionIsPerServing?: boolean;
}

interface CustomFoodModalProps {
  open: boolean;
  barcode?: string | null;
  onClose: () => void;
  onSave: (input: CustomFoodInput) => void;
}

const CATEGORIES: FoodCategory[] = ['protein', 'carb', 'fat', 'vegetable', 'snack'];
const MEAL_WINDOWS: MealWindow[] = ['breakfast', 'lunch', 'dinner', 'snacks'];

function requiredNumber(value: string, field: string): number {
  if (!value.trim()) throw new Error(`${field} is required.`);
  return Number(value);
}

function optionalNumber(value: string): number {
  return value.trim() ? Number(value) : 0;
}

export default function CustomFoodModal({ open, barcode, onClose, onSave }: CustomFoodModalProps) {
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [servings, setServings] = useState('1');
  const [saveToCatalog, setSaveToCatalog] = useState(true);
  const [category, setCategory] = useState<FoodCategory>('snack');
  const [mealWindow, setMealWindow] = useState<MealWindow>('snacks');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setName(''); setCalories(''); setProtein(''); setCarbs(''); setFat(''); setServings('1');
      setSaveToCatalog(true); setCategory('snack'); setMealWindow('snacks'); setError(null);
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const nutrition = validateNutrition({
        calories: requiredNumber(calories, 'Calories'),
        proteinGrams: optionalNumber(protein),
        carbGrams: optionalNumber(carbs),
        fatGrams: optionalNumber(fat),
      });
      onSave({
        name: assertRequiredName(name, 'Food name'),
        ...nutrition,
        servings: validateServings(requiredNumber(servings, 'Servings')),
        nutritionIsPerServing: true,
        saveToCatalog,
        category,
        mealWindow,
      });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to log this food. Please check the values and try again.');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Log Custom Food">
      <form onSubmit={handleSubmit} className="space-y-3" noValidate>
        {error && <p id="custom-food-error" role="alert" className="rounded-lg bg-accent-red/10 px-3 py-2 text-sm text-accent-red">{error}</p>}
        {barcode && <p className="text-xs text-slate-400">Barcode <span className="font-mono text-slate-300">{barcode}</span> was not found — enter label details manually.</p>}
        <div>
          <label htmlFor="custom-food-name" className="mb-1.5 block text-sm font-medium text-slate-300">Food Name</label>
          <input id="custom-food-name" className="input" value={name} onChange={(e) => { setName(e.target.value); setError(null); }} placeholder="e.g. Homemade Protein Bar" aria-invalid={Boolean(error)} aria-describedby={error ? 'custom-food-error' : undefined} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="custom-food-calories" className="mb-1.5 block text-sm font-medium text-slate-300">Calories per serving</label>
            <input id="custom-food-calories" type="number" min="0" max="10000" step="any" inputMode="decimal" className="input" value={calories} onChange={(e) => { setCalories(e.target.value); setError(null); }} aria-invalid={Boolean(error)} />
          </div>
          <div>
            <label htmlFor="custom-food-servings" className="mb-1.5 block text-sm font-medium text-slate-300">Servings to log</label>
            <input id="custom-food-servings" type="number" min="0.01" max="100" step="0.25" inputMode="decimal" className="input" value={servings} onChange={(e) => { setServings(e.target.value); setError(null); }} aria-invalid={Boolean(error)} />
          </div>
        </div>
        <div>
          <label htmlFor="custom-food-category" className="mb-1.5 block text-sm font-medium text-slate-300">Category</label>
          <select id="custom-food-category" className="input" value={category} onChange={(e) => setCategory(e.target.value as FoodCategory)}>{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><label htmlFor="custom-food-protein" className="mb-1.5 block text-sm font-medium text-slate-300">Protein (g)</label><input id="custom-food-protein" type="number" min="0" max="2000" step="any" className="input" value={protein} onChange={(e) => { setProtein(e.target.value); setError(null); }} aria-invalid={Boolean(error)} /></div>
          <div><label htmlFor="custom-food-carbs" className="mb-1.5 block text-sm font-medium text-slate-300">Carbs (g)</label><input id="custom-food-carbs" type="number" min="0" max="2000" step="any" className="input" value={carbs} onChange={(e) => { setCarbs(e.target.value); setError(null); }} aria-invalid={Boolean(error)} /></div>
          <div><label htmlFor="custom-food-fat" className="mb-1.5 block text-sm font-medium text-slate-300">Fat (g)</label><input id="custom-food-fat" type="number" min="0" max="2000" step="any" className="input" value={fat} onChange={(e) => { setFat(e.target.value); setError(null); }} aria-invalid={Boolean(error)} /></div>
        </div>
        <div>
          <label htmlFor="custom-food-meal" className="mb-1.5 block text-sm font-medium text-slate-300">Meal Window</label>
          <select id="custom-food-meal" className="input" value={mealWindow} onChange={(e) => setMealWindow(e.target.value as MealWindow)}>{MEAL_WINDOWS.map((w) => <option key={w} value={w}>{w}</option>)}</select>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" className="accent-accent-green" checked={saveToCatalog} onChange={(e) => setSaveToCatalog(e.target.checked)} />Save as Custom Recipe</label>
        <p className="-mt-1 text-xs text-slate-500">Per-serving nutrition is scaled only once when this entry is logged. Zero-calorie foods are supported.</p>
        <div className="flex gap-2 pt-2">
          <button type="submit" className="flex-1 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent/90">Log &amp; Save</button>
          <button type="button" onClick={onClose} className="rounded-lg bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/10">Cancel</button>
        </div>
      </form>
    </Modal>
  );
}
