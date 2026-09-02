'use client';

import { useMemo, useState } from 'react';
import { useMealPlannerStore } from '@/store/useMealPlannerStore';
import { compareRawAndCookedCalories, getDietaryWarnings } from '@/lib/fitnessMealPlanner';
import type { CookingOption, DietaryWarning, MealWindow } from '@/lib/fitnessMealPlanner';
import { CATEGORY_FALLBACK_ICON } from '@/lib/foodCatalog';
import type { CatalogFoodItem } from '@/lib/foodCatalog';
import { getPortionGuideForCategory } from '@/lib/portionGuides';
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

export default function PortionGallery() {
  const profile = useMealPlannerStore((s) => s.profile);
  const foodCatalog = useMealPlannerStore((s) => s.foodCatalog);
  const loggedFoods = useMealPlannerStore((s) => s.loggedFoods);
  const [portionMode, setPortionMode] = useState<PortionMode>('raw');

  const catalogById = useMemo(() => {
    const map = new Map<string, CatalogFoodItem>();
    for (const food of foodCatalog) map.set(food.id, food);
    return map;
  }, [foodCatalog]);

  const foodsByMeal = useMemo(() => {
    const result: Record<MealWindow, CatalogFoodItem[]> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snacks: [],
    };
    for (const food of foodCatalog) {
      for (const window of food.mealWindows) {
        result[window].push(food);
      }
    }
    return result;
  }, [foodCatalog]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-2xl border border-surface-border bg-surface-card p-4">
        <div>
          <h3 className="text-base font-semibold text-white">Portion Gallery</h3>
          <p className="text-sm text-gray-500">Photo view of logged and recommended meals with raw/cooked portions</p>
        </div>
        <div className="flex rounded-xl bg-white/5 p-1">
          <button
            onClick={() => setPortionMode('raw')}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
              portionMode === 'raw' ? 'bg-accent text-black' : 'text-gray-300'
            }`}
          >
            Raw
          </button>
          <button
            onClick={() => setPortionMode('cooked')}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
              portionMode === 'cooked' ? 'bg-accent text-black' : 'text-gray-300'
            }`}
          >
            Cooked
          </button>
        </div>
      </div>

      <Card title="Logged Today" subtitle="Photos of everything you've logged so far">
        {loggedFoods.length === 0 ? (
          <p className="text-sm text-gray-600">No foods logged yet — log food from the Meal Plan tab.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {loggedFoods.map((entry) => {
              const food = catalogById.get(entry.foodId);
              const cookingOption = food?.cookingOptions.find((o) => o.method === entry.cookingMethod) ?? food?.cookingOptions[0];
              const warnings = food ? getDietaryWarnings(food, profile) : [];
              return (
                <PortionPhotoCard
                  key={entry.id}
                  name={entry.name}
                  foodId={food?.id}
                  category={food?.category}
                  imageUrl={food?.imageUrl}
                  portion={food ? (entry.portionMode === 'raw' ? food.portionRaw : food.portionCooked) : entry.portionMode}
                  calories={entry.calories}
                  proteinGrams={food?.proteinGrams}
                  carbGrams={food?.carbGrams}
                  fatGrams={food?.fatGrams}
                  cookingOption={cookingOption}
                  warnings={warnings}
                />
              );
            })}
          </div>
        )}
      </Card>

      {(Object.keys(MEAL_LABELS) as MealWindow[]).map((window) => (
        <Card key={window} title={`Recommended — ${MEAL_LABELS[window]}`}>
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
                    category={food.category}
                    imageUrl={food.imageUrl}
                    portion={portion}
                    calories={calories}
                    proteinGrams={food.proteinGrams}
                    carbGrams={food.carbGrams}
                    fatGrams={food.fatGrams}
                    cookingOption={food.cookingOptions[0]}
                    warnings={getDietaryWarnings(food, profile)}
                  />
                );
              })}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

function PortionPhotoCard({
  name,
  foodId,
  category,
  imageUrl,
  portion,
  calories,
  proteinGrams,
  carbGrams,
  fatGrams,
  cookingOption,
  warnings = [],
}: {
  name: string;
  foodId?: string;
  category?: keyof typeof CATEGORY_FALLBACK_ICON;
  imageUrl?: string;
  portion: string;
  calories: number;
  proteinGrams?: number;
  carbGrams?: number;
  fatGrams?: number;
  cookingOption?: CookingOption;
  warnings?: DietaryWarning[];
}) {
  const portionGuide = category ? getPortionGuideForCategory(category).guide : undefined;
  const hasMacros = proteinGrams !== undefined || carbGrams !== undefined || fatGrams !== undefined;

  return (
    <div className="overflow-hidden rounded-xl border border-surface-border bg-white/5">
      <div className="relative w-full overflow-hidden bg-gradient-to-br from-white/10 to-white/0">
        <FoodImage
          src={imageUrl}
          alt={name}
          portionGuide={portionGuide}
          item={foodId ? { id: foodId, name, ingredientQuery: name } : undefined}
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
        <p className="mt-1 text-xs text-slate-400">Portion: {portion}</p>
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
