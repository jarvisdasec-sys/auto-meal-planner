'use client';

import { useMealPlannerStore } from '@/store/useMealPlannerStore';
import Card from './ui/Card';

export default function RecipeBox() {
  const savedRecipes = useMealPlannerStore((s) => s.savedRecipes);
  const removeSavedRecipe = useMealPlannerStore((s) => s.removeSavedRecipe);
  const logFood = useMealPlannerStore((s) => s.logFood);

  return (
    <div className="space-y-6">
      <Card title="Recipe Box" subtitle="Your saved custom recipes and meals, ready to add to today's plan">
        {savedRecipes.length === 0 ? (
          <p className="text-sm text-slate-500">
            No saved recipes yet — check &quot;Save as Custom Recipe&quot; when adding a custom food from the Meal
            Plan or Live Calorie Tracker tabs.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {savedRecipes.map((recipe) => (
              <div key={recipe.id} className="flex flex-col justify-between rounded-xl border border-surface-border bg-white/5 p-4">
                <div>
                  <h4 className="text-sm font-semibold text-slate-100">{recipe.name}</h4>
                  <p className="mt-1 text-lg font-bold text-accent-green">{Math.round(recipe.calories)} kcal</p>
                  <p className="text-xs text-slate-500">
                    P {recipe.proteinGrams}g · C {recipe.carbGrams}g · F {recipe.fatGrams}g
                  </p>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() =>
                      logFood(recipe.foodId ?? `recipe-${recipe.id}`, recipe.name, recipe.calories, 'raw', 'raw')
                    }
                    className="flex-1 rounded-lg bg-accent/90 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent"
                  >
                    Add to Today&apos;s Plan
                  </button>
                  <button
                    onClick={() => removeSavedRecipe(recipe.id)}
                    className="rounded-lg bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-400 transition-colors hover:bg-white/10 hover:text-accent-red"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
