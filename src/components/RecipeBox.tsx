'use client';

import { useMemo, useState } from 'react';
import { useMealPlannerStore, type SavedRecipe } from '@/store/useMealPlannerStore';
import {
  evaluateDietarySafety,
  type CookingMethod,
  type DietaryDescriptor,
  type MealWindow,
  type StoreName,
} from '@/lib/fitnessMealPlanner';
import type { CatalogFoodItem, FoodCategory } from '@/lib/foodCatalog';
import { localDateKey, addDays } from '@/lib/dateKeys';
import { buildStorePrices, STORE_NAMES } from '@/lib/stores';
import FoodImage from './FoodImage';
import Card from './ui/Card';

const MEAL_WINDOWS: MealWindow[] = ['breakfast', 'lunch', 'dinner', 'snacks'];
const MEAL_LABELS: Record<MealWindow, string> = {
  breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snacks: 'Snacks',
};

type PlanSelection = { day: number; mealWindow: MealWindow };

function recipeMealWindow(recipe: SavedRecipe): MealWindow {
  return recipe.mealWindow && MEAL_WINDOWS.includes(recipe.mealWindow) ? recipe.mealWindow : 'dinner';
}

function positiveNumber(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function displayNumber(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(Math.round(value * 10) / 10) : '—';
}

function recipeDescriptor(recipe: SavedRecipe, linkedFood?: CatalogFoodItem): DietaryDescriptor {
  return {
    name: recipe.name,
    ingredients: recipe.ingredients ?? linkedFood?.ingredients,
    allergens: recipe.allergens ?? linkedFood?.dietaryTags.allergens,
    dietaryFlags: recipe.dietaryFlags ?? linkedFood?.dietaryTags,
  };
}

/** Plan slots need catalog items. This is one recipe serving: free-text ingredient amounts and prices are never guessed. */
function recipePlanItem(recipe: SavedRecipe, mealWindow: MealWindow, linkedFood?: CatalogFoodItem): CatalogFoodItem {
  const descriptor = recipeDescriptor(recipe, linkedFood);
  const flags = descriptor.dietaryFlags;
  const unavailablePrices = STORE_NAMES.reduce<Partial<Record<StoreName, boolean>>>((prices, store) => {
    prices[store] = false;
    return prices;
  }, {});
  const category: FoodCategory = recipe.carbGrams >= recipe.proteinGrams && recipe.carbGrams >= recipe.fatGrams
    ? 'carb'
    : recipe.fatGrams > recipe.proteinGrams ? 'fat' : 'protein';
  const cookingMethod: CookingMethod = recipe.cookingMethod ?? 'raw';

  return {
    id: `saved-recipe-plan-${recipe.id}-${mealWindow}`,
    barcode: `recipe-${recipe.id}`,
    name: recipe.name,
    category,
    imageUrl: recipe.imageUrl ?? linkedFood?.imageUrl,
    portionRaw: '1 saved recipe serving',
    portionCooked: '1 saved recipe serving',
    caloriesRaw: recipe.calories,
    caloriesCooked: recipe.calories,
    proteinGrams: recipe.proteinGrams,
    carbGrams: recipe.carbGrams,
    fatGrams: recipe.fatGrams,
    macroBasis: 'raw',
    snackProfile: [],
    // Explicitly unavailable, so an unpriced saved recipe makes a grocery total partial—not free.
    estimatedPrices: buildStorePrices(0),
    priceAvailability: unavailablePrices,
    cookingOptions: [{ method: cookingMethod, prepTimeMinutes: 0, cookTimeMinutes: 0, macroMultiplier: { calories: 1, protein: 1, carbs: 1, fat: 1 } }],
    dietaryTags: {
      allergens: descriptor.allergens ?? flags?.allergens ?? [],
      isHighFodmap: flags?.isHighFodmap ?? false,
      isGerdTrigger: flags?.isGerdTrigger ?? false,
      containsGluten: flags?.containsGluten ?? false,
      containsLactose: flags?.containsLactose ?? false,
      spiceLevel: flags?.spiceLevel ?? 'none',
    },
    ingredients: descriptor.ingredients,
    mealWindows: [mealWindow],
  };
}

function recipeMatches(recipe: SavedRecipe, query: string, mealFilter: MealWindow | 'all'): boolean {
  if (mealFilter !== 'all' && recipe.mealWindow !== mealFilter) return false;
  const tokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const haystack = [recipe.name, ...(recipe.ingredients ?? []), ...(recipe.instructions ?? [])].join(' ').toLowerCase();
  return tokens.every((token) => haystack.includes(token));
}

export default function RecipeBox() {
  const savedRecipes = useMealPlannerStore((state) => state.savedRecipes);
  const profile = useMealPlannerStore((state) => state.profile);
  const foodCatalog = useMealPlannerStore((state) => state.foodCatalog);
  const weeklyPlan = useMealPlannerStore((state) => state.weeklyPlan);
  const removeSavedRecipe = useMealPlannerStore((state) => state.removeSavedRecipe);
  const logFood = useMealPlannerStore((state) => state.logFood);
  const addCustomFood = useMealPlannerStore((state) => state.addCustomFood);
  const substituteWeeklyPlanSlot = useMealPlannerStore((state) => state.substituteWeeklyPlanSlot);
  const [query, setQuery] = useState('');
  const [mealFilter, setMealFilter] = useState<MealWindow | 'all'>('all');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loggingServings, setLoggingServings] = useState<Record<string, string>>({});
  const [planSelections, setPlanSelections] = useState<Record<string, PlanSelection>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filteredRecipes = useMemo(
    () => savedRecipes.filter((recipe) => recipeMatches(recipe, query, mealFilter)),
    [mealFilter, query, savedRecipes],
  );
  const planStartDate = weeklyPlan?.startDateKey ?? localDateKey();

  const logRecipe = (recipe: SavedRecipe, linkedFood: CatalogFoodItem | undefined) => {
    const servings = positiveNumber(loggingServings[recipe.id] ?? '1');
    const descriptor = recipeDescriptor(recipe, linkedFood);
    const dietary = evaluateDietarySafety(descriptor, profile);
    if (!servings) {
      setError(`Enter a positive number of saved servings before logging ${recipe.name}.`);
      return;
    }
    if (dietary.hardBlocked) {
      setError(`${recipe.name} cannot be logged: ${dietary.hardBlockReasons.join('; ')}.`);
      return;
    }
    try {
      // A recipe id intentionally avoids catalog recalculation. The shared store scales the saved per-serving snapshot once.
      logFood(`saved-recipe-${recipe.id}`, recipe.name, recipe.calories, recipe.portionMode ?? 'raw', recipe.cookingMethod ?? 'raw', recipe.oilAddition, recipe.mealWindow, {
        proteinGrams: recipe.proteinGrams, carbGrams: recipe.carbGrams, fatGrams: recipe.fatGrams,
      }, {
        servings, nutritionIsPerServing: true, portion: '1 saved recipe serving', imageUrl: recipe.imageUrl ?? linkedFood?.imageUrl,
        ingredients: descriptor.ingredients, allergens: descriptor.allergens, dietaryFlags: descriptor.dietaryFlags, source: 'saved_recipe',
      });
      setError(null);
      setStatus(`Logged ${displayNumber(servings)} saved serving${servings === 1 ? '' : 's'} of ${recipe.name} to today.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Could not log ${recipe.name}. Please review the recipe details and try again.`);
    }
  };

  const addRecipeToPlan = (recipe: SavedRecipe, linkedFood: CatalogFoodItem | undefined) => {
    const selection = planSelections[recipe.id] ?? { day: 1, mealWindow: recipeMealWindow(recipe) };
    const descriptor = recipeDescriptor(recipe, linkedFood);
    const dietary = evaluateDietarySafety(descriptor, profile);
    if (dietary.hardBlocked) {
      setError(`${recipe.name} cannot be added to the plan: ${dietary.hardBlockReasons.join('; ')}.`);
      return;
    }
    const targetDate = addDays(planStartDate, selection.day - 1);
    try {
      const planFood = recipePlanItem(recipe, selection.mealWindow, linkedFood);
      addCustomFood(planFood);
      substituteWeeklyPlanSlot(selection.day, selection.mealWindow, planFood.id, 1);
      setError(null);
      setStatus(`Added ${recipe.name} to ${MEAL_LABELS[selection.mealWindow].toLowerCase()} on ${targetDate}. Existing weekly-plan slots were kept.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Could not add ${recipe.name} to the weekly plan. Please try again.`);
    }
  };

  return (
    <div className="space-y-6">
      <Card title="Recipe Box" subtitle="Search saved recipes, log actual intake, or place one saved serving in your weekly plan.">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <label className="sr-only" htmlFor="recipe-search">Search saved recipes</label>
          <input id="recipe-search" className="input flex-1" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search recipe names, ingredients, or instructions" />
          <label className="sr-only" htmlFor="recipe-meal-filter">Filter recipes by meal</label>
          <select id="recipe-meal-filter" className="input sm:w-48" value={mealFilter} onChange={(event) => setMealFilter(event.target.value as MealWindow | 'all')}>
            <option value="all">All meal windows</option>
            {MEAL_WINDOWS.map((window) => <option key={window} value={window}>{MEAL_LABELS[window]}</option>)}
          </select>
        </div>

        {status && <p role="status" aria-live="polite" className="mb-3 rounded-lg bg-accent-green/15 px-3 py-2 text-xs font-medium text-accent-green">{status}</p>}
        {error && <p role="alert" className="mb-3 rounded-lg bg-accent-red/15 px-3 py-2 text-xs font-medium text-accent-red">{error}</p>}

        {savedRecipes.length === 0 ? (
          <p className="text-sm text-slate-500">No saved recipes yet — save a custom food or recipe to find it here later.</p>
        ) : filteredRecipes.length === 0 ? (
          <p className="text-sm text-slate-500">No saved recipes match that search or meal filter.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredRecipes.map((recipe) => {
              const linkedFood = recipe.foodId ? foodCatalog.find((food) => food.id === recipe.foodId) : undefined;
              const descriptor = recipeDescriptor(recipe, linkedFood);
              const dietary = evaluateDietarySafety(descriptor, profile);
              const isExpanded = Boolean(expanded[recipe.id]);
              const selection = planSelections[recipe.id] ?? { day: 1, mealWindow: recipeMealWindow(recipe) };
              const targetDate = addDays(planStartDate, selection.day - 1);
              const servings = loggingServings[recipe.id] ?? '1';
              const detailsId = `recipe-details-${recipe.id}`;

              return (
                <article key={recipe.id} className="flex flex-col overflow-hidden rounded-xl border border-surface-border bg-white/5">
                  <FoodImage
                    src={recipe.imageUrl ?? linkedFood?.imageUrl}
                    alt={recipe.name}
                    item={{ id: `saved-recipe-${recipe.id}`, name: recipe.name, barcode: linkedFood?.barcode, imageUrl: recipe.imageUrl ?? linkedFood?.imageUrl, ingredientQuery: recipe.name }}
                    className="h-36"
                  />
                  <div className="flex flex-1 flex-col p-4">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-100">{recipe.name}</h4>
                      <p className="mt-1 text-lg font-bold text-accent-green">{displayNumber(recipe.calories)} kcal</p>
                      <p className="text-xs text-slate-400">P {displayNumber(recipe.proteinGrams)}g · C {displayNumber(recipe.carbGrams)}g · F {displayNumber(recipe.fatGrams)}g</p>
                      <p className="mt-1 text-xs text-slate-500">Nutrition is per saved serving.</p>
                      {recipe.mealWindow && MEAL_WINDOWS.includes(recipe.mealWindow) && <p className="mt-1 text-xs text-slate-400">Saved for {MEAL_LABELS[recipe.mealWindow]}.</p>}
                    </div>

                    <div className="mt-3 space-y-1.5">
                      {dietary.hardBlocked && <p className="rounded-md bg-accent-red/15 px-2 py-1 text-[11px] font-medium text-accent-red">Blocked: {dietary.hardBlockReasons.join('; ')}</p>}
                      {dietary.warnings.filter((warning) => warning.severity === 'amber').map((warning) => <p key={warning.label} className="rounded-md bg-accent-amber/15 px-2 py-1 text-[11px] font-medium text-accent-amber">{warning.label}</p>)}
                      {dietary.verification === 'unverified' && <p className="rounded-md bg-accent-amber/15 px-2 py-1 text-[11px] font-medium text-accent-amber">Safety details are unverified — review ingredients before eating or planning this recipe.</p>}
                    </div>

                    <div className="mt-3">
                      <label className="mb-1 block text-xs font-medium text-slate-300" htmlFor={`recipe-servings-${recipe.id}`}>Servings to log</label>
                      <input id={`recipe-servings-${recipe.id}`} aria-label={`Servings to log for ${recipe.name}`} type="number" min="0.25" step="0.25" value={servings} onChange={(event) => setLoggingServings((current) => ({ ...current, [recipe.id]: event.target.value }))} className="input w-full" />
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" onClick={() => logRecipe(recipe, linkedFood)} disabled={dietary.hardBlocked} className="flex-1 rounded-lg bg-accent/90 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50">Log to Today</button>
                      <button type="button" aria-expanded={isExpanded} aria-controls={detailsId} onClick={() => setExpanded((current) => ({ ...current, [recipe.id]: !current[recipe.id] }))} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/20">{isExpanded ? 'Hide Details' : 'View Details'}</button>
                      <button type="button" onClick={() => removeSavedRecipe(recipe.id)} className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-400 transition-colors hover:bg-white/10 hover:text-accent-red">Remove</button>
                    </div>

                    {isExpanded && (
                      <section id={detailsId} className="mt-4 space-y-4 border-t border-surface-border pt-4">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <p className="rounded-lg bg-white/5 p-2 text-slate-300"><span className="block text-slate-500">Saved yield</span>{recipe.servings ? `${displayNumber(recipe.servings)} servings` : 'Serving details unavailable'}</p>
                          <p className="rounded-lg bg-white/5 p-2 text-slate-300"><span className="block text-slate-500">Default preparation</span>{recipe.cookingMethod ?? 'Not saved'}{recipe.portionMode ? ` · ${recipe.portionMode}` : ''}</p>
                        </div>
                        <div>
                          <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-300">Ingredients (guidance)</h5>
                          {recipe.ingredients?.length ? <ul className="mt-1 list-inside list-disc space-y-1 text-xs text-slate-400">{recipe.ingredients.map((ingredient, index) => <li key={`${ingredient}-${index}`}>{ingredient}</li>)}</ul> : <p className="mt-1 text-xs text-slate-500">No ingredient details were saved for this legacy recipe.</p>}
                          <p className="mt-1 text-[11px] text-slate-500">Ingredient amounts are guidance only; no grocery quantities are inferred from free text.</p>
                        </div>
                        <div>
                          <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-300">Instructions</h5>
                          {recipe.instructions?.length ? <ol className="mt-1 list-inside list-decimal space-y-1 text-xs text-slate-400">{recipe.instructions.map((instruction, index) => <li key={`${instruction}-${index}`}>{instruction}</li>)}</ol> : <p className="mt-1 text-xs text-slate-500">No preparation instructions were saved for this legacy recipe.</p>}
                        </div>
                        <div className="rounded-lg border border-accent/30 bg-accent/10 p-3">
                          <h5 className="text-xs font-semibold text-slate-100">Add one saved serving to the weekly plan</h5>
                          <p className="mt-1 text-[11px] text-slate-400">Target: {MEAL_LABELS[selection.mealWindow]} on <strong className="text-slate-200">{targetDate}</strong>. This changes that slot only and keeps other plan slots.</p>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <label className="text-[11px] text-slate-300">Plan day
                              <select aria-label={`Plan day for ${recipe.name}`} className="input mt-1 w-full text-xs" value={selection.day} onChange={(event) => setPlanSelections((current) => ({ ...current, [recipe.id]: { ...selection, day: Number(event.target.value) } }))}>
                                {[1, 2, 3, 4, 5, 6, 7].map((day) => <option key={day} value={day}>Day {day} — {addDays(planStartDate, day - 1)}</option>)}
                              </select>
                            </label>
                            <label className="text-[11px] text-slate-300">Meal window
                              <select aria-label={`Plan meal window for ${recipe.name}`} className="input mt-1 w-full text-xs" value={selection.mealWindow} onChange={(event) => setPlanSelections((current) => ({ ...current, [recipe.id]: { ...selection, mealWindow: event.target.value as MealWindow } }))}>
                                {MEAL_WINDOWS.map((window) => <option key={window} value={window}>{MEAL_LABELS[window]}</option>)}
                              </select>
                            </label>
                          </div>
                          <button type="button" onClick={() => addRecipeToPlan(recipe, linkedFood)} disabled={dietary.hardBlocked} className="mt-3 w-full rounded-lg bg-accent-green/90 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent-green disabled:cursor-not-allowed disabled:opacity-50">Add Recipe to Plan</button>
                          <p className="mt-2 text-[11px] text-slate-500">Saved recipes have no inferred price, so any grocery total remains partial until a price is supplied elsewhere.</p>
                        </div>
                      </section>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
