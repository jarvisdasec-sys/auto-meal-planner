'use client';

import { useEffect, useMemo, useState } from 'react';
import FoodImage from './FoodImage';
import { isDateKey, type DateKey } from '@/lib/dateKeys';
import { RECIPE_MEAL_BY_ID, RECIPE_MEAL_LABELS, recipeCost, recipeIngredientQuantities, recipeNutrition, recipeSafety, type RecipeMeal, type RecipeWeekSlot } from '@/lib/recipeMeals';
import { useMealPlannerStore } from '@/store/useMealPlannerStore';
import type { UserProfile } from '@/lib/fitnessMealPlanner';

function number(value: number, places = 0): string { return (Math.round(value * 10 ** places) / 10 ** places).toLocaleString(); }

export interface RecipeMealCardProps {
  slot: RecipeWeekSlot;
  date: DateKey;
  profile: UserProfile;
  candidates: RecipeMeal[];
  locked: boolean;
  favorite: boolean;
  onSwap: (recipeId: string) => void;
  onServings: (servings: number) => void;
  onLock: () => void;
  onFavorite: () => void;
  onStatus: (message: string, kind?: 'success' | 'error') => void;
}

export default function RecipeMealCard({ slot, date, profile, candidates, locked, favorite, onSwap, onServings, onLock, onFavorite, onStatus }: RecipeMealCardProps) {
  const logFood = useMealPlannerStore((state) => state.logFood);
  const recipe = RECIPE_MEAL_BY_ID[slot.recipeId];
  const [expanded, setExpanded] = useState(false);
  const [swapId, setSwapId] = useState(slot.recipeId);
  const [logDate, setLogDate] = useState<DateKey>(date);
  const [servings, setServings] = useState(String(slot.servings));
  const nutrition = useMemo(() => recipeNutrition(recipe, slot.servings), [recipe, slot.servings]);
  const quantities = useMemo(() => recipeIngredientQuantities(recipe, slot.servings), [recipe, slot.servings]);
  const safety = recipeSafety(recipe, profile);

  useEffect(() => { setSwapId(slot.recipeId); setServings(String(slot.servings)); }, [slot.recipeId, slot.servings]);
  useEffect(() => { setLogDate(date); }, [date]);

  const saveServings = () => {
    const value = Number(servings);
    if (!Number.isFinite(value) || value <= 0 || value > 100) { onStatus('Enter a positive serving amount up to 100.', 'error'); setServings(String(slot.servings)); return; }
    onServings(value);
  };

  const logConsumed = () => {
    if (!isDateKey(logDate)) { onStatus('Choose a valid local calendar date before logging.', 'error'); return; }
    if (safety.hardBlocked) { onStatus(`${recipe.name} cannot be logged: ${safety.reasons.join('; ')}.`, 'error'); return; }
    try {
      // The catalog id deliberately does not map to the original food catalog: these are final
      // per-recipe-serving snapshots and the existing store scales them once via this flag.
      const perServing = recipeNutrition(recipe, 1);
      logFood(`recipe-week-${recipe.id}`, recipe.name, perServing.calories, 'cooked', 'baked', undefined, slot.mealWindow, {
        proteinGrams: perServing.proteinGrams, carbGrams: perServing.carbGrams, fatGrams: perServing.fatGrams,
      }, {
        servings: slot.servings, nutritionIsPerServing: true, dateKey: logDate, portion: `${slot.servings} recipe serving${slot.servings === 1 ? '' : 's'}`,
        imageUrl: recipe.imageUrl, ingredients: quantities.map((item) => `${number(item.grams, 1)} g ${item.ingredient.name}`), allergens: recipe.dietaryFlags.allergens,
        dietaryFlags: recipe.dietaryFlags, source: 'recipe_week',
      });
      onStatus(`Logged ${number(slot.servings, 2)} serving${slot.servings === 1 ? '' : 's'} of ${recipe.name} on ${logDate}.`);
    } catch (cause) { onStatus(cause instanceof Error ? cause.message : 'Could not log this recipe.', 'error'); }
  };

  return <article className="overflow-hidden rounded-xl border border-surface-border bg-surface-card">
    <div className="grid md:grid-cols-[180px_1fr]">
      <FoodImage src={recipe.imageUrl} alt={`${recipe.name} ingredient illustration`} item={{ id: recipe.id, name: recipe.name, imageUrl: recipe.imageUrl, ingredientQuery: recipe.name }} className="h-44 md:h-full" />
      <div className="min-w-0 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="btb-eyebrow text-accent">{RECIPE_MEAL_LABELS[slot.mealWindow]} · {recipe.prepMinutes + recipe.cookMinutes} ACTIVE MINUTES</p><h3 className="mt-1 text-xl font-bold text-slate-100">{recipe.name}</h3><p className="mt-1 text-xs text-slate-400">Yield: {recipe.yieldServings} serving{recipe.yieldServings === 1 ? '' : 's'} per recipe · measured ingredients scale to your personal servings.</p></div>
          <div className="text-right"><p className="font-display text-2xl text-accent">{number(nutrition.calories)} kcal</p><p className="text-xs text-slate-400">P {number(nutrition.proteinGrams)}g · C {number(nutrition.carbGrams)}g · F {number(nutrition.fatGrams)}g</p></div>
        </div>
        {safety.hardBlocked && <p role="alert" className="mt-3 rounded-md border border-accent-red/30 bg-accent-red/10 px-3 py-2 text-xs text-accent-red">Unavailable with your current safeguards: {safety.reasons.join('; ')}</p>}
        <div className="no-print mt-4 flex flex-wrap gap-2">
          <button type="button" className="btb-secondary px-3 py-2 text-xs" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>{expanded ? 'Hide recipe' : 'View recipe'}</button>
          <button type="button" className="btb-secondary px-3 py-2 text-xs" aria-pressed={locked} onClick={onLock}>{locked ? 'Unlock meal' : 'Lock meal'}</button>
          <button type="button" className="btb-secondary px-3 py-2 text-xs" aria-pressed={favorite} onClick={onFavorite}>{favorite ? '★ Favorited' : '☆ Favorite'}</button>
        </div>
        <div className="no-print mt-4 grid gap-3 border-t border-surface-border pt-4 sm:grid-cols-3">
          <label className="text-xs text-slate-300">Personal servings
            <input aria-label={`Personal servings for ${recipe.name}`} className="input mt-1" type="number" min="0.25" max="100" step="0.25" value={servings} onChange={(event) => setServings(event.target.value)} onBlur={saveServings} onKeyDown={(event) => { if (event.key === 'Enter') { event.currentTarget.blur(); } }} />
          </label>
          <label className="text-xs text-slate-300">Swap recipe
            <select aria-label={`Swap ${recipe.name}`} className="input mt-1" value={swapId} onChange={(event) => { setSwapId(event.target.value); onSwap(event.target.value); }} disabled={!candidates.length}>
              {candidates.length ? candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>) : <option>No safe choices</option>}
            </select>
          </label>
          <label className="text-xs text-slate-300">Log consumption date
            <input aria-label={`Consumption date for ${recipe.name}`} className="input mt-1" type="date" value={logDate} onChange={(event) => setLogDate(event.target.value as DateKey)} />
          </label>
        </div>
        <div className="no-print mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-[11px] text-slate-500">Logging is optional and only happens when you press the button. Planned meals never count as eaten.</p><button type="button" className="btb-button px-3 py-2 text-xs" onClick={logConsumed} disabled={safety.hardBlocked}>Log consumed</button></div>
        {expanded && <section className="mt-5 grid gap-5 border-t border-surface-border pt-5 lg:grid-cols-[1fr_1.1fr]" aria-label={`${recipe.name} details`}>
          <div><h4 className="btb-eyebrow text-slate-300">INGREDIENTS · PERSONAL QUANTITY</h4><ul className="mt-2 space-y-1.5 text-sm text-slate-300">{quantities.map((item) => <li key={item.ingredientId} className="flex justify-between gap-3"><span>{number(item.grams, 1)} g {item.ingredient.name} ({item.ingredient.measuredAs}){item.note ? ` — ${item.note}` : ''}</span><span className="shrink-0 text-slate-500">${item.costUsd.toFixed(2)} est.</span></li>)}</ul><p className="mt-3 text-[11px] text-slate-500">Illustrative ingredient cost: ${recipeCost(recipe, slot.servings).toFixed(2)}. {` ${recipe.yieldServings} serving`} base recipe; ingredient artwork is illustrative.</p></div>
          <div><h4 className="btb-eyebrow text-slate-300">DIRECTIONS</h4><ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-slate-300">{recipe.instructions.map((instruction) => <li key={instruction}>{instruction}</li>)}</ol></div>
        </section>}
      </div>
    </div>
  </article>;
}
