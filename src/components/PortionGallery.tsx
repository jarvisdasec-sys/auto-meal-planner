'use client';

import { useMemo, useState } from 'react';
import { getActiveWeeklyPlan, useMealPlannerStore } from '@/store/useMealPlannerStore';
import { compareRawAndCookedCalories, getDietaryWarnings } from '@/lib/fitnessMealPlanner';
import type { CookingOption, DietaryWarning, MealWindow } from '@/lib/fitnessMealPlanner';
import type { CatalogFoodItem } from '@/lib/foodCatalog';
import { getEntryNutrition } from '@/lib/nutritionLedger';
import { buildMealWindowGroups } from '@/lib/pantryPlanner';
import { ALL_PORTION_GUIDES, getPortionGuideForFood } from '@/lib/portionGuides';
import type { PortionGuide } from '@/lib/portionGuides';
import { formatLabel } from '@/lib/format';
import FoodImage from './FoodImage';
import Card from './ui/Card';

type PortionMode = 'raw' | 'cooked';

const MEAL_LABELS: Record<MealWindow, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
};

function emptyMealGroups(): Record<MealWindow, CatalogFoodItem[]> {
  return {
    breakfast: [],
    lunch: [],
    dinner: [],
    snacks: [],
  };
}

function mergeLoggedWarnings(currentWarnings: DietaryWarning[], savedWarnings: string[] | undefined): DietaryWarning[] {
  const warnings = new Map(currentWarnings.map((warning) => [warning.label, warning]));
  for (const label of savedWarnings ?? []) {
    if (label.trim() && !warnings.has(label)) warnings.set(label, { label, severity: 'amber' });
  }
  return Array.from(warnings.values());
}

export default function PortionGallery() {
  const profile = useMealPlannerStore((s) => s.profile);
  const foodCatalog = useMealPlannerStore((s) => s.foodCatalog);
  const loggedFoods = useMealPlannerStore((s) => s.loggedFoods);
  const weeklyPlan = useMealPlannerStore((s) => s.weeklyPlan);
  const [portionMode, setPortionMode] = useState<PortionMode>('raw');

  const catalogById = useMemo(() => {
    const map = new Map<string, CatalogFoodItem>();
    for (const food of foodCatalog) map.set(food.id, food);
    return map;
  }, [foodCatalog]);

  const profileFilteredFoodsByMeal = useMemo(() => buildMealWindowGroups(foodCatalog, profile), [foodCatalog, profile]);

  const activeWeeklyPlan = useMemo(
    () => getActiveWeeklyPlan({ weeklyPlan, foodCatalog, profile }),
    [foodCatalog, profile, weeklyPlan],
  );

  const foodsByMeal = useMemo(() => {
    // An active plan is the authoritative recommendation when present. Intersecting
    // it with the same shared groups prevents a legacy plan from bypassing current
    // hard exclusions or a changed snack-craving preference.
    if (activeWeeklyPlan.length === 0) return profileFilteredFoodsByMeal;

    const plannedFoodsByMeal = emptyMealGroups();
    const seenByMeal: Record<MealWindow, Set<string>> = {
      breakfast: new Set(),
      lunch: new Set(),
      dinner: new Set(),
      snacks: new Set(),
    };
    for (const slot of activeWeeklyPlan) {
      const isEligible = profileFilteredFoodsByMeal[slot.mealWindow].some((food) => food.id === slot.food.id);
      if (isEligible && !seenByMeal[slot.mealWindow].has(slot.food.id)) {
        plannedFoodsByMeal[slot.mealWindow].push(slot.food);
        seenByMeal[slot.mealWindow].add(slot.food.id);
      }
    }
    return plannedFoodsByMeal;
  }, [activeWeeklyPlan, profileFilteredFoodsByMeal]);

  const recommendationSubtitle = activeWeeklyPlan.length > 0
    ? 'From your active weekly plan after applying your current profile preferences'
    : 'Profile-filtered options that match your current meal and snack preferences';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-2xl border border-surface-border bg-surface-card p-4">
        <div>
          <h3 className="text-base font-semibold text-white">Portion Gallery</h3>
          <p className="text-sm text-gray-500">Photo view of logged and recommended meals with raw/cooked portions</p>
        </div>
        <div className="flex rounded-xl bg-white/5 p-1">
          <button
            type="button"
            onClick={() => setPortionMode('raw')}
            aria-pressed={portionMode === 'raw'}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
              portionMode === 'raw' ? 'bg-accent text-black' : 'text-gray-300'
            }`}
          >
            Raw
          </button>
          <button
            type="button"
            onClick={() => setPortionMode('cooked')}
            aria-pressed={portionMode === 'cooked'}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
              portionMode === 'cooked' ? 'bg-accent text-black' : 'text-gray-300'
            }`}
          >
            Cooked
          </button>
        </div>
      </div>

      <Card title="Saved Food Logs" subtitle="Saved nutrition snapshots, including historical entries">
        {loggedFoods.length === 0 ? (
          <p className="text-sm text-gray-600">No foods logged yet — log food from the Meal Plan tab.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {loggedFoods.map((entry) => {
              const food = catalogById.get(entry.foodId);
              const cookingOption = food?.cookingOptions.find((o) => o.method === entry.cookingMethod) ?? food?.cookingOptions[0];
              const nutrition = getEntryNutrition(entry, foodCatalog);
              const guide = getPortionGuideForFood({
                id: food?.id ?? entry.foodId,
                name: entry.name,
                category: food?.category,
              });
              const warnings = mergeLoggedWarnings(food ? getDietaryWarnings(food, profile) : [], entry.dietaryWarnings);
              return (
                <PortionPhotoCard
                  key={entry.id}
                  name={entry.name}
                  foodId={food?.id}
                  barcode={food?.barcode}
                  imageUrl={entry.imageUrl ?? food?.imageUrl}
                  portion={entry.portion ?? (food ? (entry.portionMode === 'raw' ? food.portionRaw : food.portionCooked) : 'Saved portion')}
                  portionMode={entry.portionMode}
                  calories={nutrition.calories}
                  proteinGrams={nutrition.proteinGrams}
                  carbGrams={nutrition.carbGrams}
                  fatGrams={nutrition.fatGrams}
                  cookingOption={cookingOption}
                  portionGuide={guide}
                  warnings={warnings}
                />
              );
            })}
          </div>
        )}
      </Card>

      {(Object.keys(MEAL_LABELS) as MealWindow[]).map((window) => (
        <Card key={window} title={`Recommended — ${MEAL_LABELS[window]}`} subtitle={recommendationSubtitle}>
          {foodsByMeal[window].length === 0 ? (
            <p className="text-sm text-gray-600">No matching foods for this meal window.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {foodsByMeal[window].map((food) => {
                const comparison = compareRawAndCookedCalories(food);
                const portion = portionMode === 'raw' ? comparison.portionRaw : comparison.portionCooked;
                const calories = portionMode === 'raw' ? comparison.caloriesRaw : comparison.caloriesCooked;
                return (
                  <PortionPhotoCard
                    key={food.id}
                    name={food.name}
                    foodId={food.id}
                    barcode={food.barcode}
                    imageUrl={food.imageUrl}
                    portion={portion}
                    portionMode={portionMode}
                    calories={calories}
                    proteinGrams={food.proteinGrams}
                    carbGrams={food.carbGrams}
                    fatGrams={food.fatGrams}
                    cookingOption={food.cookingOptions[0]}
                    portionGuide={getPortionGuideForFood(food)}
                    warnings={getDietaryWarnings(food, profile)}
                  />
                );
              })}
            </div>
          )}
        </Card>
      ))}

      <Card title="Approximate hand-guide legend" subtitle="Hand guides are visual estimates; use each card's measured raw or cooked portion for tracking.">
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5" aria-label="Approximate hand-guide legend">
          {ALL_PORTION_GUIDES.map((guide) => (
            <li key={guide.guide} className="rounded-lg bg-white/5 p-3 text-xs text-slate-400">
              <p className={`font-semibold ${guide.colorClass}`}>{guide.emoji} {guide.label}</p>
              <p className="mt-1 text-slate-200">Measure: {guide.measure}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function PortionPhotoCard({
  name,
  foodId,
  barcode,
  imageUrl,
  portion,
  portionMode,
  calories,
  proteinGrams,
  carbGrams,
  fatGrams,
  cookingOption,
  portionGuide,
  warnings = [],
}: {
  name: string;
  foodId?: string;
  barcode?: string;
  imageUrl?: string;
  portion: string;
  portionMode: PortionMode;
  calories: number;
  proteinGrams?: number;
  carbGrams?: number;
  fatGrams?: number;
  cookingOption?: CookingOption;
  portionGuide?: PortionGuide;
  warnings?: DietaryWarning[];
}) {
  const hasMacros = proteinGrams !== undefined || carbGrams !== undefined || fatGrams !== undefined;

  return (
    <div className="overflow-hidden rounded-xl border border-surface-border bg-white/5">
      <div className="relative w-full overflow-hidden bg-gradient-to-br from-white/10 to-white/0">
        <FoodImage
          src={imageUrl}
          alt={name}
          portionGuide={portionGuide?.guide}
          item={foodId ? { id: foodId, name, ingredientQuery: name, upc: barcode } : undefined}
        />
        <div className="absolute bottom-2 right-2 rounded-lg bg-black/70 px-2 py-1 text-right text-xs font-semibold text-accent backdrop-blur">
          <div>{Math.round(calories)} kcal</div>
          {hasMacros && (
            <div className="font-normal text-slate-300">
              P{proteinGrams ?? 0} · C{carbGrams ?? 0} · F{fatGrams ?? 0}
            </div>
          )}
        </div>
      </div>
      <div className="p-4">
        <h4 className="text-sm font-semibold text-slate-100">{name}</h4>
        <p className="mt-1 text-xs text-slate-300">
          Measured {portionMode} portion: <span className="text-slate-100">{portion}</span>
        </p>
        {portionGuide && (
          <section className="mt-2 rounded-lg bg-white/5 p-2 text-[11px]" aria-label={`Approximate hand guide for ${name}`}>
            <p className={`font-semibold ${portionGuide.colorClass}`}>
              Approximate hand guide (illustration): {portionGuide.emoji} {portionGuide.label}
            </p>
            <p className="mt-0.5 text-slate-300">Measure: {portionGuide.measure}</p>
            <p className="mt-0.5 text-slate-500">{portionGuide.description}</p>
          </section>
        )}
        {warnings.length > 0 && (
          <div className="mt-2 space-y-1">
            {warnings.map((warning) => (
              <p
                key={warning.label}
                className={`rounded-md px-2 py-1 text-[11px] font-medium ${
                  warning.severity === 'red' ? 'bg-accent-red/15 text-accent-red' : 'bg-accent-amber/15 text-accent-amber'
                }`}
              >
                {warning.label}
              </p>
            ))}
          </div>
        )}
        {cookingOption && (
          <div className="mt-2 space-y-1">
            <span className="inline-block rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
              {formatLabel(cookingOption.method)}
            </span>
            <p className="text-[11px] text-slate-500">
              Prep {cookingOption.prepTimeMinutes}m · Cook {cookingOption.cookTimeMinutes}m
              {cookingOption.recommendedTempF ? ` · ${cookingOption.recommendedTempF}°F` : ''}
            </p>
            {cookingOption.cookingTip && <p className="text-[11px] italic text-slate-500">{cookingOption.cookingTip}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
