'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMealPlannerStore } from '@/store/useMealPlannerStore';
import { ALL_NUTRITION_CATEGORIES } from '@/types/nutrition';
import type { NutritionCategory, NutritionItem, ServingUnit } from '@/types/nutrition';
import { NUTRITION_DATABASE } from '@/data/nutritionDatabase';
import { loadMyFoods, saveMyFoods } from '@/lib/myFoodsStorage';
import { formatLabel } from '@/lib/format';
import Card from './ui/Card';
import FoodImage from './FoodImage';

const SERVING_UNITS: ServingUnit[] = ['g', 'oz', 'cup', 'scoop', 'slice', 'tbsp', 'tsp', 'piece', 'ml', 'serving'];

function matchesQuery(item: NutritionItem, query: string): boolean {
  if (!query.trim()) return true;
  const haystack = [item.name, item.brand ?? '', ...item.dietaryTags].join(' ').toLowerCase();
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  return tokens.every((token) => haystack.includes(token));
}

export default function FoodLogger() {
  const logFood = useMealPlannerStore((s) => s.logFood);
  const [myFoods, setMyFoods] = useState<NutritionItem[]>([]);
  const [category, setCategory] = useState<NutritionCategory | 'all'>('all');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);

  useEffect(() => {
    setMyFoods(loadMyFoods());
  }, []);

  const allItems = useMemo(() => [...NUTRITION_DATABASE, ...myFoods], [myFoods]);

  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      if (category !== 'all' && item.category !== category) return false;
      return matchesQuery(item, query);
    });
  }, [allItems, category, query]);

  const foods = filteredItems.filter((item) => !item.isSupplement);
  const supplements = filteredItems.filter((item) => item.isSupplement);

  const handleLog = (item: NutritionItem) => {
    logFood(item.isCustom ? item.id : `nutrition-${item.id}-${crypto.randomUUID()}`, item.name, item.calories, 'raw', 'raw', undefined, undefined, {
      proteinGrams: item.proteinGrams,
      carbGrams: item.carbGrams,
      fatGrams: item.fatGrams,
    });
    setStatus(`Logged ${item.name} (${item.calories} kcal).`);
  };

  const handleSaveCustomFood = (item: NutritionItem) => {
    const updated = [...myFoods, item];
    setMyFoods(updated);
    saveMyFoods(updated);
    setShowBuilder(false);
    setStatus(`Saved ${item.name} to My Foods.`);
  };

  return (
    <div className="space-y-6">
      <Card title="Food Logger" subtitle="Search the master nutrition & supplement database">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, brand, or tag (e.g. Keto, High protein)"
            className="input flex-1"
          />
          <select value={category} onChange={(e) => setCategory(e.target.value as NutritionCategory | 'all')} className="input sm:w-56">
            <option value="all">All Categories</option>
            {ALL_NUTRITION_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'supplement' ? 'Supplements' : formatLabel(cat)}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowBuilder((prev) => !prev)}
            className="rounded-lg bg-accent-green/90 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-green"
          >
            + Custom Food
          </button>
        </div>
        {status && <p className="mt-2 text-xs text-slate-400">{status}</p>}
      </Card>

      {showBuilder && <CustomFoodBuilder onSave={handleSaveCustomFood} onCancel={() => setShowBuilder(false)} />}

      <Card title={`Foods (${foods.length})`}>
        {foods.length === 0 ? (
          <p className="text-sm text-slate-500">No matching foods found.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {foods.map((item) => (
              <NutritionItemCard key={item.id} item={item} onLog={() => handleLog(item)} />
            ))}
          </div>
        )}
      </Card>

      <Card title={`Supplements (${supplements.length})`} subtitle="Pre-workouts, protein powders, and other supplements">
        {supplements.length === 0 ? (
          <p className="text-sm text-slate-500">No matching supplements found.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {supplements.map((item) => (
              <NutritionItemCard key={item.id} item={item} onLog={() => handleLog(item)} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function NutritionItemCard({ item, onLog }: { item: NutritionItem; onLog: () => void }) {
  return (
    <div className="overflow-hidden rounded-xl border border-surface-border bg-white/5">
      <FoodImage src={item.imageUrl} alt={item.name} />
      <div className="p-4">
        <h4 className="text-sm font-semibold text-slate-100">
          {item.name}
          {item.brand && <span className="ml-1.5 text-xs font-normal text-slate-400">({item.brand})</span>}
        </h4>
        <p className="mt-1 text-xs text-slate-400">
          Serving: {item.servingSize.amount} {item.servingSize.unit}
        </p>
        <p className="text-lg font-bold text-accent-green">{item.calories} kcal</p>
        <p className="text-xs text-slate-500">
          P {item.proteinGrams}g · C {item.carbGrams}g · F {item.fatGrams}g
        </p>
        {(item.fiberGrams !== undefined || item.sugarGrams !== undefined || item.sodiumMg !== undefined) && (
          <p className="text-xs text-slate-500">
            Fiber {item.fiberGrams ?? 0}g · Sugar {item.sugarGrams ?? 0}g · Sodium {item.sodiumMg ?? 0}mg
          </p>
        )}
        {item.isSupplement && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {item.caffeineMg !== undefined && (
              <span className="rounded-full bg-accent-amber/15 px-2 py-0.5 text-[11px] font-semibold text-accent-amber">
                Caffeine {item.caffeineMg}mg
              </span>
            )}
            {item.creatineGrams !== undefined && (
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">
                Creatine {item.creatineGrams}g
              </span>
            )}
            {item.activeIngredients && item.activeIngredients.length > 0 && (
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-slate-300">
                {item.activeIngredients.join(', ')}
              </span>
            )}
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {item.dietaryTags.map((tag) => (
            <span key={tag} className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">
              {formatLabel(tag)}
            </span>
          ))}
        </div>
        <button
          onClick={onLog}
          className="mt-3 w-full rounded-lg bg-accent/90 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent"
        >
          Log
        </button>
      </div>
    </div>
  );
}

function CustomFoodBuilder({
  onSave,
  onCancel,
}: {
  onSave: (item: NutritionItem) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState<NutritionCategory>('snacks');
  const [servingAmount, setServingAmount] = useState('1');
  const [servingUnit, setServingUnit] = useState<ServingUnit>('serving');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [fiber, setFiber] = useState('');
  const [sugar, setSugar] = useState('');
  const [sodium, setSodium] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !calories) return;
    onSave({
      id: `custom-${crypto.randomUUID()}`,
      name,
      brand: brand || undefined,
      category,
      isSupplement: category === 'supplement',
      isCustom: true,
      servingSize: { amount: Number(servingAmount) || 1, unit: servingUnit },
      calories: Number(calories),
      proteinGrams: Number(protein) || 0,
      carbGrams: Number(carbs) || 0,
      fatGrams: Number(fat) || 0,
      fiberGrams: fiber ? Number(fiber) : undefined,
      sugarGrams: sugar ? Number(sugar) : undefined,
      sodiumMg: sodium ? Number(sodium) : undefined,
      dietaryTags: [],
      imageUrl: imageUrl || undefined,
    });
  };

  return (
    <Card title="Custom Food & Recipe Builder" subtitle="Add your own food with custom macros, serving size, and image">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Homemade Protein Muffin" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">Brand (optional)</label>
            <input className="input" value={brand} onChange={(e) => setBrand(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">Category</label>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value as NutritionCategory)}>
              {ALL_NUTRITION_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'supplement' ? 'Supplements' : formatLabel(cat)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="mb-1.5 block text-sm font-medium text-slate-300">Serving Amount</label>
              <input type="number" className="input" value={servingAmount} onChange={(e) => setServingAmount(e.target.value)} />
            </div>
            <div className="flex-1">
              <label className="mb-1.5 block text-sm font-medium text-slate-300">Unit</label>
              <select className="input" value={servingUnit} onChange={(e) => setServingUnit(e.target.value as ServingUnit)}>
                {SERVING_UNITS.map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">Calories</label>
            <input type="number" className="input" value={calories} onChange={(e) => setCalories(e.target.value)} />
          </div>
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

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">Fiber (g)</label>
            <input type="number" className="input" value={fiber} onChange={(e) => setFiber(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">Sugar (g)</label>
            <input type="number" className="input" value={sugar} onChange={(e) => setSugar(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">Sodium (mg)</label>
            <input type="number" className="input" value={sodium} onChange={(e) => setSodium(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-300">Image URL (optional)</label>
          <input className="input" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            className="flex-1 rounded-lg bg-accent-green/90 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-green"
          >
            Save to My Foods
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg bg-white/5 px-4 py-2 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/10"
          >
            Cancel
          </button>
        </div>
      </form>
    </Card>
  );
}
