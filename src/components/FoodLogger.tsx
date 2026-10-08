'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMealPlannerStore } from '@/store/useMealPlannerStore';
import { ALL_NUTRITION_CATEGORIES } from '@/types/nutrition';
import type { NutritionCategory, NutritionItem, ServingUnit } from '@/types/nutrition';
import { NUTRITION_DATABASE } from '@/data/nutritionDatabase';
import { loadMyFoods, saveMyFoods } from '@/lib/myFoodsStorage';
import { formatLabel } from '@/lib/format';
import { evaluateDietarySafety, type Allergen, type DietaryTags, type MealWindow } from '@/lib/fitnessMealPlanner';
import { assertFiniteNumber, assertRequiredName, validateNutrition, validateServings } from '@/lib/mealPlannerValidation';
import { sanitizeRemoteUrl } from '@/lib/imageHosts';
import Card from './ui/Card';
import FoodImage from './FoodImage';

const SERVING_UNITS: ServingUnit[] = ['g', 'oz', 'cup', 'scoop', 'slice', 'tbsp', 'tsp', 'piece', 'ml', 'serving'];
const ALLERGENS: Allergen[] = ['peanuts', 'tree_nuts', 'milk', 'eggs', 'fish', 'shellfish', 'soy', 'wheat', 'sesame'];
type MyFood = NutritionItem & { instructions?: string[]; yieldServings?: number };
type Status = { kind: 'success' | 'error' | 'info'; message: string } | null;

function matchesQuery(item: NutritionItem, query: string): boolean {
  if (!query.trim()) return true;
  const haystack = [item.name, item.brand ?? '', ...item.dietaryTags, ...(item.ingredients ?? [])].join(' ').toLowerCase();
  return query.toLowerCase().split(/\s+/).filter(Boolean).every((token) => haystack.includes(token));
}

function csv(value: string): string[] | undefined {
  const entries = value.split(',').map((entry) => entry.trim()).filter(Boolean);
  return entries.length ? [...new Set(entries)] : undefined;
}

function requiredNumber(value: string, field: string): number {
  if (!value.trim()) throw new Error(`${field} is required.`);
  return Number(value);
}

function optionalNumber(value: string, field: string): number | undefined {
  if (!value.trim()) return undefined;
  return assertFiniteNumber(Number(value), field, { min: 0, max: 100000, allowZero: true });
}

function formatError(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback;
}

export default function FoodLogger() {
  const logFood = useMealPlannerStore((s) => s.logFood);
  const addSavedRecipe = useMealPlannerStore((s) => s.addSavedRecipe);
  const profile = useMealPlannerStore((s) => s.profile);
  const [myFoods, setMyFoods] = useState<MyFood[]>([]);
  const [category, setCategory] = useState<NutritionCategory | 'all'>('all');
  const [query, setQuery] = useState('');
  const [mealType, setMealType] = useState<MealWindow>('breakfast');
  const [status, setStatus] = useState<Status>(null);
  const [showBuilder, setShowBuilder] = useState(false);

  useEffect(() => { setMyFoods(loadMyFoods() as MyFood[]); }, []);

  const allItems = useMemo(() => [...NUTRITION_DATABASE, ...myFoods], [myFoods]);
  const filteredItems = useMemo(() => allItems.filter((item) => (category === 'all' || item.category === category) && matchesQuery(item, query)), [allItems, category, query]);
  const foods = filteredItems.filter((item) => !item.isSupplement);
  const supplements = filteredItems.filter((item) => item.isSupplement);

  const handleLog = (item: NutritionItem, servings: number) => {
    const dietary = evaluateDietarySafety(item, profile);
    if (dietary.hardBlocked) {
      setStatus({ kind: 'error', message: `${item.name} cannot be logged: ${dietary.hardBlockReasons.join('; ')}.` });
      return;
    }
    try {
      // Nutrition database/My Foods records are not necessarily store catalog items,
      // so mark their label nutrition as per listed serving and let shared logging scale once.
      logFood(
        item.isCustom ? item.id : `nutrition-${item.id}-${crypto.randomUUID()}`,
        item.name,
        item.calories,
        'raw',
        'raw',
        undefined,
        mealType,
        { proteinGrams: item.proteinGrams, carbGrams: item.carbGrams, fatGrams: item.fatGrams },
        {
          servings,
          nutritionIsPerServing: true,
          portion: `${servings} × ${item.servingSize.amount} ${item.servingSize.unit}`,
          imageUrl: item.imageUrl,
          ingredients: item.ingredients,
          allergens: item.allergens,
          dietaryFlags: item.dietaryFlags ?? item.flags,
          source: item.isCustom ? 'my_food' : 'nutrition_database',
        },
      );
      const safetyNote = dietary.verification === 'unverified' ? ' Ingredients/allergen facts are unverified.' : dietary.warnings.length ? ` Warning: ${dietary.warnings.map((warning) => warning.label).join('; ')}.` : '';
      setStatus({ kind: 'success', message: `Logged ${item.name} (${servings} listed serving${servings === 1 ? '' : 's'}) for ${formatLabel(mealType)}.${safetyNote}` });
    } catch (cause) {
      setStatus({ kind: 'error', message: formatError(cause, 'Unable to log this food. Please try again.') });
    }
  };

  const handleSaveCustomFood = (item: MyFood, mealWindow: MealWindow) => {
    try {
      const updated = [...myFoods, item];
      if (!saveMyFoods(updated)) throw new Error('My Foods could not be saved in this browser. Check storage permissions or available space, then try again.');
      setMyFoods(updated);
      addSavedRecipe({
        id: `recipe-${item.id}`,
        foodId: item.id,
        name: item.name,
        calories: item.calories,
        proteinGrams: item.proteinGrams,
        carbGrams: item.carbGrams,
        fatGrams: item.fatGrams,
        mealWindow,
        ingredients: item.ingredients,
        instructions: item.instructions,
        servings: item.yieldServings,
        imageUrl: item.imageUrl,
        portionMode: 'raw',
        cookingMethod: 'raw',
        allergens: item.allergens,
        dietaryFlags: item.dietaryFlags ?? item.flags,
      });
      setShowBuilder(false);
      setStatus({ kind: 'success', message: `Saved ${item.name} to My Foods and Recipe Box.` });
    } catch (cause) {
      setStatus({ kind: 'error', message: formatError(cause, 'Unable to save this custom food.') });
    }
  };

  return (
    <div className="space-y-6">
      <Card title="Food Logger" subtitle="Search the master nutrition & supplement database">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, brand, tag, or ingredient" aria-label="Search foods" className="input flex-1" />
          <select value={category} onChange={(e) => setCategory(e.target.value as NutritionCategory | 'all')} aria-label="Food category" className="input sm:w-56">
            <option value="all">All Categories</option>
            {ALL_NUTRITION_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat === 'supplement' ? 'Supplements' : formatLabel(cat)}</option>)}
          </select>
          <select value={mealType} onChange={(e) => setMealType(e.target.value as MealWindow)} aria-label="Meal window" className="input sm:w-40">
            <option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option><option value="snacks">Snacks</option>
          </select>
          <button onClick={() => setShowBuilder((previous) => !previous)} className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-accent/90">+ Custom Food</button>
        </div>
        {status && <p role={status.kind === 'error' ? 'alert' : 'status'} className={`mt-2 text-xs ${status.kind === 'error' ? 'text-accent-red' : status.kind === 'success' ? 'text-accent-green' : 'text-gray-400'}`}>{status.message}</p>}
      </Card>

      {showBuilder && <CustomFoodBuilder onSave={handleSaveCustomFood} onCancel={() => setShowBuilder(false)} />}

      <FoodCollection title={`Foods (${foods.length})`} items={foods} profile={profile} onLog={handleLog} />
      <FoodCollection title={`Supplements (${supplements.length})`} subtitle="Pre-workouts, protein powders, and other supplements" items={supplements} profile={profile} onLog={handleLog} />
    </div>
  );
}

function FoodCollection({ title, subtitle, items, profile, onLog }: { title: string; subtitle?: string; items: NutritionItem[]; profile: Parameters<typeof evaluateDietarySafety>[1]; onLog: (item: NutritionItem, servings: number) => void }) {
  return (
    <Card title={title} subtitle={subtitle}>
      {items.length === 0 ? <p className="text-sm text-gray-600">No matching foods found.</p> : <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map((item) => <NutritionItemCard key={item.id} item={item} dietary={evaluateDietarySafety(item, profile)} onLog={onLog} />)}</div>}
    </Card>
  );
}

function NutritionItemCard({ item, dietary, onLog }: { item: NutritionItem; dietary: ReturnType<typeof evaluateDietarySafety>; onLog: (item: NutritionItem, servings: number) => void }) {
  const [servings, setServings] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const handleLog = () => {
    try {
      const multiplier = validateServings(Number(servings));
      setError(null);
      onLog(item, multiplier);
    } catch (cause) {
      setError(formatError(cause, 'Enter a positive serving multiplier.'));
    }
  };
  return (
    <div className="overflow-hidden rounded-xl border border-surface-border bg-white/5">
      <FoodImage src={item.imageUrl} alt={item.name} portionGuide={item.portionGuide} item={{ id: item.id, name: item.name, ingredientQuery: item.name }} />
      <div className="p-4">
        <h4 className="text-sm font-semibold text-white">{item.name}{item.brand && <span className="ml-1.5 text-xs font-normal text-gray-500">({item.brand})</span>}</h4>
        <p className="mt-1 text-xs text-gray-500">Listed serving: {item.servingSize.amount} {item.servingSize.unit}</p>
        <p className="text-lg font-bold text-accent">{item.calories} kcal</p>
        <p className="text-xs text-gray-600">P {item.proteinGrams}g · C {item.carbGrams}g · F {item.fatGrams}g</p>
        {(item.fiberGrams !== undefined || item.sugarGrams !== undefined || item.sodiumMg !== undefined) && <p className="text-xs text-gray-600">Fiber {item.fiberGrams ?? 0}g · Sugar {item.sugarGrams ?? 0}g · Sodium {item.sodiumMg ?? 0}mg</p>}
        {item.isSupplement && <SupplementBadges item={item} />}
        <div className="mt-2 flex flex-wrap gap-1.5">{item.dietaryTags.map((tag) => <span key={tag} className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-gray-400">{formatLabel(tag)}</span>)}</div>
        <div className="mt-2 space-y-1 text-[11px]">
          {dietary.hardBlockReasons.map((reason) => <p key={reason} className="text-accent-red">{reason}</p>)}
          {dietary.warnings.filter((warning) => warning.severity === 'amber').map((warning) => <p key={warning.label} className="text-accent-amber">{warning.label}</p>)}
          {dietary.verification === 'unverified' && <p className="text-accent-amber">Ingredients and allergen facts are unverified.</p>}
        </div>
        <div className="mt-3 flex gap-2">
          <label className="min-w-0 flex-1 text-xs text-gray-400" htmlFor={`servings-${item.id}`}>Multiplier relative to listed serving
            <input id={`servings-${item.id}`} type="number" min="0.01" max="100" step="0.25" inputMode="decimal" value={servings} onChange={(event) => { setServings(event.target.value); setError(null); }} className="input mt-1 w-full" aria-invalid={Boolean(error)} />
          </label>
          <button onClick={handleLog} disabled={dietary.hardBlocked} className="mt-5 rounded-lg bg-accent/90 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:bg-slate-700" title={dietary.hardBlocked ? dietary.hardBlockReasons.join('; ') : undefined}>{dietary.hardBlocked ? 'Blocked' : 'Log'}</button>
        </div>
        <p className="mt-1 text-[10px] text-gray-500">Multiplier only: cup, scoop, and piece sizes are not converted to grams without a known mass basis.</p>
        {error && <p role="alert" className="mt-1 text-xs text-accent-red">{error}</p>}
      </div>
    </div>
  );
}

function SupplementBadges({ item }: { item: NutritionItem }) {
  return <div className="mt-2 flex flex-wrap gap-1.5">
    {item.caffeineMg !== undefined && <span className="rounded-full bg-accent-amber/15 px-2 py-0.5 text-[11px] font-semibold text-accent-amber">Caffeine {item.caffeineMg}mg</span>}
    {item.creatineGrams !== undefined && <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">Creatine {item.creatineGrams}g</span>}
    {item.activeIngredients?.length ? <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-gray-300">{item.activeIngredients.join(', ')}</span> : null}
  </div>;
}

function CustomFoodBuilder({ onSave, onCancel }: { onSave: (item: MyFood, mealWindow: MealWindow) => void; onCancel: () => void }) {
  const [name, setName] = useState(''); const [brand, setBrand] = useState(''); const [category, setCategory] = useState<NutritionCategory>('snacks');
  const [servingAmount, setServingAmount] = useState('1'); const [servingUnit, setServingUnit] = useState<ServingUnit>('serving');
  const [calories, setCalories] = useState(''); const [protein, setProtein] = useState(''); const [carbs, setCarbs] = useState(''); const [fat, setFat] = useState('');
  const [fiber, setFiber] = useState(''); const [sugar, setSugar] = useState(''); const [sodium, setSodium] = useState(''); const [imageUrl, setImageUrl] = useState('');
  const [ingredients, setIngredients] = useState(''); const [instructions, setInstructions] = useState(''); const [yieldServings, setYieldServings] = useState('');
  const [allergens, setAllergens] = useState<Allergen[]>([]); const [containsGluten, setContainsGluten] = useState(false); const [containsLactose, setContainsLactose] = useState(false); const [highFodmap, setHighFodmap] = useState(false); const [gerdTrigger, setGerdTrigger] = useState(false); const [spiceLevel, setSpiceLevel] = useState<DietaryTags['spiceLevel']>('none');
  const [mealWindow, setMealWindow] = useState<MealWindow>('breakfast'); const [error, setError] = useState<string | null>(null);

  const toggleAllergen = (allergen: Allergen) => setAllergens((current) => current.includes(allergen) ? current.filter((entry) => entry !== allergen) : [...current, allergen]);
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const safeImage = imageUrl.trim() ? sanitizeRemoteUrl(imageUrl.trim()) : undefined;
      if (imageUrl.trim() && !safeImage) throw new Error('Use a supported HTTPS image host (Open Food Facts, Unsplash, Walmart, Kroger, or Spoonacular) or a single-slash local image path.');
      const nutrition = validateNutrition({ calories: requiredNumber(calories, 'Calories'), proteinGrams: protein.trim() ? Number(protein) : 0, carbGrams: carbs.trim() ? Number(carbs) : 0, fatGrams: fat.trim() ? Number(fat) : 0 });
      const safeName = assertRequiredName(name, 'Name');
      const knownIngredients = csv(ingredients);
      const dietaryFlags = allergens.length || containsGluten || containsLactose || highFodmap || gerdTrigger || spiceLevel !== 'none'
        ? { allergens, containsGluten, containsLactose, isHighFodmap: highFodmap, isGerdTrigger: gerdTrigger, spiceLevel }
        : undefined;
      const item: MyFood = {
        id: `custom-${crypto.randomUUID()}`, name: safeName, brand: brand.trim() || undefined, category, isSupplement: category === 'supplement', isCustom: true,
        servingSize: { amount: validateServings(Number(servingAmount)), unit: servingUnit }, ...nutrition,
        fiberGrams: optionalNumber(fiber, 'Fiber'), sugarGrams: optionalNumber(sugar, 'Sugar'), sodiumMg: optionalNumber(sodium, 'Sodium'), dietaryTags: [], imageUrl: safeImage,
        ingredients: knownIngredients, allergens: allergens.length ? allergens : undefined,
        dietaryFlags,
        instructions: csv(instructions), yieldServings: yieldServings.trim() ? validateServings(Number(yieldServings)) : undefined,
      };
      onSave(item, mealWindow);
    } catch (cause) { setError(formatError(cause, 'Unable to save this food. Please check the details and try again.')); }
  };

  return <Card title="Custom Food & Recipe Builder" subtitle="Add custom nutrition, recipe details, dietary facts, and an allowed image">
    <form onSubmit={handleSubmit} className="space-y-3" noValidate>
      {error && <p role="alert" className="rounded-lg bg-accent-red/10 px-3 py-2 text-sm text-accent-red">{error}</p>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Name" id="builder-name"><input id="builder-name" className="input" value={name} onChange={(e) => { setName(e.target.value); setError(null); }} placeholder="e.g. Homemade Protein Muffin" /></Field>
        <Field label="Brand (optional)" id="builder-brand"><input id="builder-brand" className="input" value={brand} onChange={(e) => setBrand(e.target.value)} /></Field>
        <Field label="Category" id="builder-category"><select id="builder-category" className="input" value={category} onChange={(e) => setCategory(e.target.value as NutritionCategory)}>{ALL_NUTRITION_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat === 'supplement' ? 'Supplements' : formatLabel(cat)}</option>)}</select></Field>
        <Field label="Meal Window" id="builder-meal"><select id="builder-meal" className="input" value={mealWindow} onChange={(e) => setMealWindow(e.target.value as MealWindow)}><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option><option value="snacks">Snacks</option></select></Field>
      </div>
      <div className="grid grid-cols-2 gap-3"><Field label="Listed Serving Amount" id="builder-serving-amount"><input id="builder-serving-amount" type="number" min="0.01" max="100" step="any" className="input" value={servingAmount} onChange={(e) => setServingAmount(e.target.value)} /></Field><Field label="Unit" id="builder-serving-unit"><select id="builder-serving-unit" className="input" value={servingUnit} onChange={(e) => setServingUnit(e.target.value as ServingUnit)}>{SERVING_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select></Field></div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Field label="Calories" id="builder-calories"><input id="builder-calories" type="number" min="0" max="10000" step="any" className="input" value={calories} onChange={(e) => { setCalories(e.target.value); setError(null); }} /></Field><Field label="Protein (g)" id="builder-protein"><input id="builder-protein" type="number" min="0" max="2000" step="any" className="input" value={protein} onChange={(e) => setProtein(e.target.value)} /></Field><Field label="Carbs (g)" id="builder-carbs"><input id="builder-carbs" type="number" min="0" max="2000" step="any" className="input" value={carbs} onChange={(e) => setCarbs(e.target.value)} /></Field><Field label="Fat (g)" id="builder-fat"><input id="builder-fat" type="number" min="0" max="2000" step="any" className="input" value={fat} onChange={(e) => setFat(e.target.value)} /></Field></div>
      <div className="grid grid-cols-3 gap-3"><Field label="Fiber (g)" id="builder-fiber"><input id="builder-fiber" type="number" min="0" step="any" className="input" value={fiber} onChange={(e) => setFiber(e.target.value)} /></Field><Field label="Sugar (g)" id="builder-sugar"><input id="builder-sugar" type="number" min="0" step="any" className="input" value={sugar} onChange={(e) => setSugar(e.target.value)} /></Field><Field label="Sodium (mg)" id="builder-sodium"><input id="builder-sodium" type="number" min="0" step="any" className="input" value={sodium} onChange={(e) => setSodium(e.target.value)} /></Field></div>
      <Field label="Ingredients (optional, comma-separated)" id="builder-ingredients"><input id="builder-ingredients" className="input" value={ingredients} onChange={(e) => setIngredients(e.target.value)} placeholder="e.g. oats, milk, egg" /></Field>
      <Field label="Instructions (optional, comma-separated steps)" id="builder-instructions"><textarea id="builder-instructions" className="input min-h-20" value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="e.g. Mix, bake 18 minutes" /></Field>
      <Field label="Recipe yield (optional servings)" id="builder-yield"><input id="builder-yield" type="number" min="0.01" max="100" step="any" className="input" value={yieldServings} onChange={(e) => setYieldServings(e.target.value)} /></Field>
      <Field label="Image URL (optional)" id="builder-image"><input id="builder-image" className="input" value={imageUrl} onChange={(e) => { setImageUrl(e.target.value); setError(null); }} placeholder="Allowed HTTPS host or /images/food/example.jpg" /><p className="mt-1 text-xs text-slate-500">Supported hosts: Open Food Facts, Unsplash, Walmart, Kroger, Spoonacular; local paths must start with one slash.</p></Field>
      <fieldset className="rounded-lg border border-surface-border p-3"><legend className="px-1 text-sm font-medium text-gray-300">Known dietary facts</legend><div className="mt-1 flex flex-wrap gap-x-3 gap-y-2 text-xs text-gray-300">{ALLERGENS.map((allergen) => <label key={allergen} className="flex items-center gap-1"><input type="checkbox" checked={allergens.includes(allergen)} onChange={() => toggleAllergen(allergen)} />{formatLabel(allergen)}</label>)}</div><div className="mt-3 flex flex-wrap gap-x-3 gap-y-2 text-xs text-gray-300"><label><input type="checkbox" checked={containsGluten} onChange={(e) => setContainsGluten(e.target.checked)} /> Contains gluten</label><label><input type="checkbox" checked={containsLactose} onChange={(e) => setContainsLactose(e.target.checked)} /> Contains lactose</label><label><input type="checkbox" checked={highFodmap} onChange={(e) => setHighFodmap(e.target.checked)} /> High FODMAP</label><label><input type="checkbox" checked={gerdTrigger} onChange={(e) => setGerdTrigger(e.target.checked)} /> GERD trigger</label><label>Spice <select value={spiceLevel} onChange={(e) => setSpiceLevel(e.target.value as DietaryTags['spiceLevel'])} className="ml-1 rounded bg-white/10 px-1">{(['none', 'mild', 'medium', 'spicy'] as const).map((level) => <option key={level} value={level}>{level}</option>)}</select></label></div></fieldset>
      <div className="flex gap-2 pt-2"><button type="submit" className="flex-1 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-accent/90">Save to My Foods</button><button type="button" onClick={onCancel} className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-gray-300 transition-colors hover:bg-accent/40">Cancel</button></div>
    </form>
  </Card>;
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) { return <div><label htmlFor={id} className="mb-1.5 block text-sm font-medium text-gray-300">{label}</label>{children}</div>; }
