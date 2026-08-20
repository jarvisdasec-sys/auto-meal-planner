'use client';

import { useEffect, useState } from 'react';
import Modal from './ui/Modal';
import type { MealWindow } from '@/lib/fitnessMealPlanner';

export interface LogFoodInput {
  name: string;
  mealType: MealWindow;
  calories: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
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

export default function LogFoodModal({ open, onClose, onSave }: LogFoodModalProps) {
  const [name, setName] = useState('');
  const [mealType, setMealType] = useState<MealWindow>('breakfast');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  useEffect(() => {
    if (!open) {
      setName('');
      setMealType('breakfast');
      setCalories('');
      setProtein('');
      setCarbs('');
      setFat('');
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !calories) return;
    onSave({
      name,
      mealType,
      calories: Number(calories),
      proteinGrams: Number(protein) || 0,
      carbGrams: Number(carbs) || 0,
      fatGrams: Number(fat) || 0,
    });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Log Food / Meal">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-300">Food / Meal Name</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Grilled Chicken & Rice"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-300">Meal Type</label>
          <select className="input" value={mealType} onChange={(e) => setMealType(e.target.value as MealWindow)}>
            {MEAL_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-300">Calories (kcal)</label>
          <input type="number" className="input" value={calories} onChange={(e) => setCalories(e.target.value)} />
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
        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            className="flex-1 rounded-lg bg-accent-green/90 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-green"
          >
            Log Food
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
