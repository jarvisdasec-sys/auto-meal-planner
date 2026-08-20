'use client';

import { useEffect, useState } from 'react';
import Modal from './ui/Modal';
import type { FoodCategory } from '@/lib/foodCatalog';
import type { MealWindow } from '@/lib/fitnessMealPlanner';

export interface CustomFoodInput {
  name: string;
  calories: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
  saveToCatalog: boolean;
  category: FoodCategory;
  mealWindow: MealWindow;
}

interface CustomFoodModalProps {
  open: boolean;
  barcode?: string | null;
  onClose: () => void;
  onSave: (input: CustomFoodInput) => void;
}

const CATEGORIES: FoodCategory[] = ['protein', 'carb', 'fat', 'vegetable', 'snack'];
const MEAL_WINDOWS: MealWindow[] = ['breakfast', 'lunch', 'dinner', 'snacks'];

export default function CustomFoodModal({ open, barcode, onClose, onSave }: CustomFoodModalProps) {
  const [name, setName] = useState('');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [saveToCatalog, setSaveToCatalog] = useState(true);
  const [category, setCategory] = useState<FoodCategory>('snack');
  const [mealWindow, setMealWindow] = useState<MealWindow>('snacks');

  useEffect(() => {
    if (!open) {
      setName('');
      setCalories('');
      setProtein('');
      setCarbs('');
      setFat('');
      setSaveToCatalog(true);
      setCategory('snack');
      setMealWindow('snacks');
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !calories) return;
    onSave({
      name,
      calories: Number(calories),
      proteinGrams: Number(protein) || 0,
      carbGrams: Number(carbs) || 0,
      fatGrams: Number(fat) || 0,
      saveToCatalog,
      category,
      mealWindow,
    });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Log Custom Food">
      <form onSubmit={handleSubmit} className="space-y-3">
        {barcode && (
          <p className="text-xs text-slate-400">
            Barcode <span className="font-mono text-slate-300">{barcode}</span> not found — enter details manually.
          </p>
        )}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-300">Food Name</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Homemade Protein Bar"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">Calories</label>
            <input type="number" className="input" value={calories} onChange={(e) => setCalories(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">Category</label>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value as FoodCategory)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">Protein (g)</label>
            <input type="number" className="input" value={protein} onChange={(e) => setProtein(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">Carbs (g)</label>
            <input type="number" className="input" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">Fat (g)</label>
            <input type="number" className="input" value={fat} onChange={(e) => setFat(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-300">Meal Window</label>
          <select
            className="input"
            value={mealWindow}
            onChange={(e) => setMealWindow(e.target.value as MealWindow)}
          >
            {MEAL_WINDOWS.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            className="accent-accent-green"
            checked={saveToCatalog}
            onChange={(e) => setSaveToCatalog(e.target.checked)}
          />
          Save as Custom Recipe
        </label>
        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            className="flex-1 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent/90"
          >
            Log &amp; Save
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/10"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
