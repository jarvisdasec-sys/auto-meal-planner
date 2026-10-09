'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { formatLabel } from '@/lib/format';
import {
  evaluateDietarySafety,
  type Allergen,
  type CookingMethod,
  type MealWindow,
} from '@/lib/fitnessMealPlanner';
import { assertRequiredName, validateNutrition, validateServings } from '@/lib/mealPlannerValidation';
import { useMealPlannerStore } from '@/store/useMealPlannerStore';
import Card from './ui/Card';

const MEAL_WINDOWS: MealWindow[] = ['breakfast', 'lunch', 'dinner', 'snacks'];
const COOKING_METHODS: CookingMethod[] = ['raw', 'steamed', 'boiled', 'baked', 'air_fried', 'pan_fried', 'deep_fried', 'grilled'];
const ALLERGENS: Allergen[] = ['peanuts', 'tree_nuts', 'milk', 'eggs', 'fish', 'shellfish', 'soy', 'wheat', 'sesame'];

const MEAL_LABELS: Record<MealWindow, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
};

type NutritionBasis = 'per-serving' | 'batch';

export interface RecipeBuilderProps {
  /** Called after a validated recipe has been added to the saved-recipes store. */
  onSaved?: () => void;
}

function parseNumberInput(value: string): number {
  // Number('') is zero, but a blank nutrition field is not a user-supplied estimate.
  return value.trim() ? Number(value) : Number.NaN;
}

function lines(value: string): string[] {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function createRecipeId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `saved-recipe-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function displayNumber(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return String(Math.round(value * 100) / 100);
}

export default function RecipeBuilder({ onSaved }: RecipeBuilderProps) {
  const addSavedRecipe = useMealPlannerStore((state) => state.addSavedRecipe);
  const profile = useMealPlannerStore((state) => state.profile);

  const [name, setName] = useState('');
  const [mealWindow, setMealWindow] = useState<MealWindow>('dinner');
  const [yieldInput, setYieldInput] = useState('1');
  const [nutritionBasis, setNutritionBasis] = useState<NutritionBasis>('per-serving');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [ingredientsInput, setIngredientsInput] = useState('');
  const [instructionsInput, setInstructionsInput] = useState('');
  const [cookingMethod, setCookingMethod] = useState<CookingMethod>('baked');
  const [allergens, setAllergens] = useState<Allergen[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [dietaryWarning, setDietaryWarning] = useState<string | null>(null);

  const liveNutrition = useMemo(() => {
    const yieldValue = parseNumberInput(yieldInput);
    const entered = {
      calories: parseNumberInput(calories),
      proteinGrams: parseNumberInput(protein),
      carbGrams: parseNumberInput(carbs),
      fatGrams: parseNumberInput(fat),
    };
    const isUsable = Number.isFinite(yieldValue) && yieldValue > 0
      && Object.values(entered).every((value) => Number.isFinite(value) && value >= 0);
    if (!isUsable) return null;

    const divisor = nutritionBasis === 'batch' ? yieldValue : 1;
    return {
      calories: entered.calories / divisor,
      proteinGrams: entered.proteinGrams / divisor,
      carbGrams: entered.carbGrams / divisor,
      fatGrams: entered.fatGrams / divisor,
    };
  }, [calories, carbs, fat, nutritionBasis, protein, yieldInput]);

  const nutritionUnit = nutritionBasis === 'batch' ? 'entire batch' : 'per serving';

  const resetForm = () => {
    setName('');
    setMealWindow('dinner');
    setYieldInput('1');
    setNutritionBasis('per-serving');
    setCalories('');
    setProtein('');
    setCarbs('');
    setFat('');
    setIngredientsInput('');
    setInstructionsInput('');
    setCookingMethod('baked');
    setAllergens([]);
  };

  const toggleAllergen = (allergen: Allergen) => {
    setAllergens((current) => (
      current.includes(allergen)
        ? current.filter((item) => item !== allergen)
        : [...current, allergen]
    ));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const safeName = assertRequiredName(name, 'Recipe name');
      const servings = validateServings(parseNumberInput(yieldInput));
      const enteredNutrition = validateNutrition({
        calories: parseNumberInput(calories),
        proteinGrams: parseNumberInput(protein),
        carbGrams: parseNumberInput(carbs),
        fatGrams: parseNumberInput(fat),
      });
      const ingredients = lines(ingredientsInput);
      if (!ingredients.length) throw new Error('Add at least one ingredient so dietary exclusions can be checked.');

      // SavedRecipe nutrition is always a one-serving snapshot. Do not round here:
      // batch values retain the exact arithmetic division by the submitted yield.
      const divisor = nutritionBasis === 'batch' ? servings : 1;
      const savedNutrition = {
        calories: enteredNutrition.calories / divisor,
        proteinGrams: enteredNutrition.proteinGrams / divisor,
        carbGrams: enteredNutrition.carbGrams / divisor,
        fatGrams: enteredNutrition.fatGrams / divisor,
      };
      const dietary = evaluateDietarySafety({ name: safeName, ingredients, allergens }, profile);

      addSavedRecipe({
        id: createRecipeId(),
        name: safeName,
        mealWindow,
        servings,
        ...savedNutrition,
        ingredients,
        instructions: lines(instructionsInput),
        cookingMethod,
        portionMode: cookingMethod === 'raw' ? 'raw' : 'cooked',
        allergens,
      });

      setError(null);
      setStatus(`Saved ${safeName}. Nutrition is stored per serving.`);
      setDietaryWarning(dietary.hardBlocked
        ? `Saved with a dietary warning: ${dietary.hardBlockReasons.join('; ')}. Recipe Box will prevent logging or planning this recipe until the conflict is resolved.`
        : null);
      resetForm();
    } catch (cause) {
      setStatus(null);
      setDietaryWarning(null);
      setError(cause instanceof Error ? cause.message : 'Could not save this recipe. Please review the details and try again.');
      return;
    }
    onSaved?.();
  };

  return (
    <Card
      title="Build a Recipe"
      subtitle="Save your own serving snapshot for Recipe Box. No image, grocery price, or catalog macro estimate is created."
      className="bg-surface-card"
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-border pb-4">
          <div>
            <p className="btb-eyebrow text-xs font-semibold uppercase tracking-[0.16em] text-accent">Premium recipe builder</p>
            <p className="mt-1 text-sm text-slate-400">Ingredients are kept as your entered guidance; no grocery quantities or prices are inferred.</p>
          </div>
          <p className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300">Photo optional · neutral fallback</p>
        </div>

        {error && <p id="recipe-builder-error" role="alert" className="rounded-lg border border-accent-red/30 bg-accent-red/10 px-3 py-2 text-sm text-accent-red">{error}</p>}
        {status && <p role="status" aria-live="polite" className="rounded-lg border border-accent-green/30 bg-accent-green/10 px-3 py-2 text-sm text-accent-green">{status}</p>}
        {dietaryWarning && <p role="alert" className="rounded-lg border border-accent-amber/30 bg-accent-amber/10 px-3 py-2 text-sm text-accent-amber">{dietaryWarning}</p>}

        <section aria-labelledby="recipe-basics-heading" className="space-y-4">
          <h4 id="recipe-basics-heading" className="text-sm font-semibold text-slate-100">Recipe basics</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="recipe-name" className="mb-1.5 block text-sm font-medium text-slate-300">Recipe name</label>
              <input id="recipe-name" className="input" value={name} onChange={(event) => { setName(event.target.value); setError(null); }} placeholder="e.g. Weeknight lemon chicken" aria-invalid={Boolean(error)} aria-describedby={error ? 'recipe-builder-error' : undefined} />
            </div>
            <div>
              <label htmlFor="recipe-meal-window" className="mb-1.5 block text-sm font-medium text-slate-300">Meal window</label>
              <select id="recipe-meal-window" className="input" value={mealWindow} onChange={(event) => setMealWindow(event.target.value as MealWindow)}>
                {MEAL_WINDOWS.map((window) => <option key={window} value={window}>{MEAL_LABELS[window]}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="recipe-yield" className="mb-1.5 block text-sm font-medium text-slate-300">Yield (servings)</label>
              <input id="recipe-yield" type="number" min="0.01" max="100" step="0.01" inputMode="decimal" className="input" value={yieldInput} onChange={(event) => { setYieldInput(event.target.value); setError(null); }} aria-invalid={Boolean(error)} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="recipe-cooking-method" className="mb-1.5 block text-sm font-medium text-slate-300">Cooking method</label>
              <select id="recipe-cooking-method" className="input" value={cookingMethod} onChange={(event) => setCookingMethod(event.target.value as CookingMethod)}>
                {COOKING_METHODS.map((method) => <option key={method} value={method}>{method === 'raw' ? 'No-cook / raw' : formatLabel(method)}</option>)}
              </select>
            </div>
          </div>
        </section>

        <section aria-labelledby="recipe-nutrition-heading" className="space-y-4 rounded-xl border border-surface-border bg-black/10 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h4 id="recipe-nutrition-heading" className="text-sm font-semibold text-slate-100">Nutrition estimate</h4>
              <p className="mt-1 text-xs text-slate-400">Enter values from your own label, recipe, or calculation. These are user-supplied estimates, not authoritative macros.</p>
            </div>
            <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-white/5 px-3 py-2 text-xs text-slate-300">
              <input
                id="recipe-nutrition-basis"
                aria-label="Nutrition is for entire batch"
                type="checkbox"
                role="switch"
                className="mt-0.5 accent-accent"
                checked={nutritionBasis === 'batch'}
                onChange={(event) => setNutritionBasis(event.target.checked ? 'batch' : 'per-serving')}
              />
              <span><strong className="block text-slate-100">Nutrition is for the entire batch</strong>Off means values are entered per serving.</span>
            </label>
          </div>
          <p className="rounded-lg bg-accent-amber/10 px-3 py-2 text-xs text-accent-amber">Check product labels, ingredients, and cross-contact risk before eating. Known allergens are not a certification of safety.</p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div><label htmlFor="recipe-calories" className="mb-1.5 block text-xs font-medium text-slate-300">Calories ({nutritionUnit})</label><input id="recipe-calories" type="number" min="0" max="10000" step="any" inputMode="decimal" className="input" value={calories} onChange={(event) => { setCalories(event.target.value); setError(null); }} aria-invalid={Boolean(error)} /></div>
            <div><label htmlFor="recipe-protein" className="mb-1.5 block text-xs font-medium text-slate-300">Protein g ({nutritionUnit})</label><input id="recipe-protein" type="number" min="0" max="2000" step="any" inputMode="decimal" className="input" value={protein} onChange={(event) => { setProtein(event.target.value); setError(null); }} aria-invalid={Boolean(error)} /></div>
            <div><label htmlFor="recipe-carbs" className="mb-1.5 block text-xs font-medium text-slate-300">Carbs g ({nutritionUnit})</label><input id="recipe-carbs" type="number" min="0" max="2000" step="any" inputMode="decimal" className="input" value={carbs} onChange={(event) => { setCarbs(event.target.value); setError(null); }} aria-invalid={Boolean(error)} /></div>
            <div><label htmlFor="recipe-fat" className="mb-1.5 block text-xs font-medium text-slate-300">Fat g ({nutritionUnit})</label><input id="recipe-fat" type="number" min="0" max="2000" step="any" inputMode="decimal" className="input" value={fat} onChange={(event) => { setFat(event.target.value); setError(null); }} aria-invalid={Boolean(error)} /></div>
          </div>
          <div aria-live="polite" className="rounded-lg border border-accent-green/20 bg-accent-green/5 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-accent-green">Live per-serving breakdown</p>
            {liveNutrition ? (
              <p className="mt-1 text-sm text-slate-200"><strong>{displayNumber(liveNutrition.calories)} kcal</strong> · P {displayNumber(liveNutrition.proteinGrams)}g · C {displayNumber(liveNutrition.carbGrams)}g · F {displayNumber(liveNutrition.fatGrams)}g</p>
            ) : (
              <p className="mt-1 text-sm text-slate-400">Enter a positive yield and nonnegative nutrition values to preview one serving.</p>
            )}
            {nutritionBasis === 'batch' && <p className="mt-1 text-[11px] text-slate-400">Preview is rounded for display only; saved nutrition divides the batch values by yield without rounding.</p>}
          </div>
        </section>

        <section aria-labelledby="recipe-details-heading" className="space-y-4">
          <div>
            <h4 id="recipe-details-heading" className="text-sm font-semibold text-slate-100">Ingredients and directions</h4>
            <p className="mt-1 text-xs text-slate-400">Enter one item or step per line. Ingredients are required so your saved recipe can be checked against dietary exclusions.</p>
          </div>
          <div>
            <label htmlFor="recipe-ingredients" className="mb-1.5 block text-sm font-medium text-slate-300">Ingredients (one per line)</label>
            <textarea id="recipe-ingredients" rows={5} className="input min-h-28" value={ingredientsInput} onChange={(event) => { setIngredientsInput(event.target.value); setError(null); }} placeholder={'2 chicken breasts\n1 tbsp olive oil\n1 lemon'} aria-invalid={Boolean(error)} />
          </div>
          <div>
            <label htmlFor="recipe-instructions" className="mb-1.5 block text-sm font-medium text-slate-300">Instructions (one per line)</label>
            <textarea id="recipe-instructions" rows={4} className="input min-h-24" value={instructionsInput} onChange={(event) => setInstructionsInput(event.target.value)} placeholder={'Season the chicken.\nCook until done.\nRest and slice.'} />
          </div>
        </section>

        <fieldset className="space-y-3 rounded-xl border border-surface-border bg-black/10 p-4">
          <legend className="px-1 text-sm font-semibold text-slate-100">Known allergen flags</legend>
          <p className="text-xs text-slate-400">Select only allergens you know are present. Ingredients and labels still need review for substitutions and cross-contact.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ALLERGENS.map((allergen) => (
              <label key={allergen} className="flex cursor-pointer items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm text-slate-300">
                <input type="checkbox" checked={allergens.includes(allergen)} onChange={() => toggleAllergen(allergen)} className="accent-accent" />
                {formatLabel(allergen)}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => { resetForm(); setError(null); setStatus(null); setDietaryWarning(null); }} className="btb-secondary rounded-xl border border-surface-border bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/10">Clear</button>
          <button type="submit" className="btb-button rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-black transition-colors hover:bg-accent/85 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface-card">Save recipe</button>
        </div>
      </form>
    </Card>
  );
}
