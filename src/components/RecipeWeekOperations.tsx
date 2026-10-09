'use client';

import { useMemo } from 'react';
import { downloadText } from '@/lib/premiumPlanner';
import { RECIPE_PRICE_REFERENCE, aggregateRecipeIngredients, aggregateRecipePrep, recipeGroceryCsv, recipeIngredientQuantities, recipePrepCsv, recipeWeekScope, type RecipeWeekPlan } from '@/lib/recipeMeals';
import Card from './ui/Card';

function number(value: number, places = 0): string { return (Math.round(value * 10 ** places) / 10 ** places).toLocaleString(); }

export interface RecipeWeekOperationsProps {
  plan: RecipeWeekPlan;
  householdSize: number;
  purchased: Record<string, string[]>;
  prepCompleted: Record<string, string[]>;
  onHouseholdSize: (householdSize: number) => void;
  onTogglePurchased: (scope: string, ingredientId: string) => void;
  onTogglePrep: (scope: string, recipeId: string) => void;
  onStatus: (message: string, kind?: 'success' | 'error') => void;
}

function HouseholdControl({ householdSize, onHouseholdSize, onStatus }: Pick<RecipeWeekOperationsProps, 'householdSize' | 'onHouseholdSize' | 'onStatus'>) {
  return <label className="no-print text-xs text-slate-300">Household for shopping & prep only
    <input aria-label="Recipe week household size" type="number" min="1" max="20" step="1" className="input mt-1 w-32" value={householdSize} onChange={(event) => {
      const value = Number(event.target.value);
      try { onHouseholdSize(value); } catch (cause) { onStatus(cause instanceof Error ? cause.message : 'Enter a whole household size.', 'error'); }
    }} />
  </label>;
}

export function RecipeWeekShopping(props: RecipeWeekOperationsProps) {
  const { plan, householdSize, purchased, onHouseholdSize, onTogglePurchased, onStatus } = props;
  const groceries = useMemo(() => aggregateRecipeIngredients(plan.slots, householdSize), [plan.slots, householdSize]);
  const scope = recipeWeekScope(plan, householdSize);
  const checked = purchased[scope] ?? [];
  const cost = groceries.reduce((total, item) => total + item.costUsd, 0);
  const byAisle = groceries.reduce<Record<string, typeof groceries>>((grouped, item) => ({ ...grouped, [item.ingredient.aisle]: [...(grouped[item.ingredient.aisle] ?? []), item] }), {});
  return <section className="print-area space-y-5" aria-label="Recipe week shopping list">
    <Card title="Recipe Week Shopping" subtitle="Measured ingredients are household-scaled here only. Your personal servings and nutrition log are not multiplied.">
      <div className="no-print flex flex-wrap items-end justify-between gap-3"><HouseholdControl householdSize={householdSize} onHouseholdSize={onHouseholdSize} onStatus={onStatus} /><div className="flex flex-wrap gap-2"><button type="button" className="btb-secondary text-xs" onClick={() => { downloadText('BTB-recipe-week-shopping.csv', recipeGroceryCsv(plan, householdSize)); onStatus('Shopping CSV downloaded.'); }}>Download shopping CSV</button><button type="button" className="btb-secondary text-xs" onClick={() => { window.print(); onStatus('Print dialog opened for this shopping list.'); }}>Print shopping</button></div></div>
      <div className="mt-4 rounded-lg border border-accent/20 bg-accent/5 p-3"><p className="btb-eyebrow text-accent">ILLUSTRATIVE ESTIMATE</p><p className="mt-1 text-sm text-slate-200">${cost.toFixed(2)} total for {householdSize} household member{householdSize === 1 ? '' : 's'} · {groceries.length} measured ingredients</p><p className="mt-1 text-xs text-slate-400">{RECIPE_PRICE_REFERENCE}</p></div>
    </Card>
    {Object.keys(byAisle).length === 0 ? <div className="btb-empty"><p className="text-sm text-slate-400">No safe recipe ingredients are selected yet. Generate a recipe week first.</p></div> : Object.entries(byAisle).sort(([left], [right]) => left.localeCompare(right)).map(([aisle, items]) => <Card key={aisle} title={aisle} className="break-inside-avoid"><ul className="divide-y divide-surface-border">{items.map((item) => {
      const itemChecked = checked.includes(item.ingredient.id);
      return <li key={item.ingredient.id} className="flex items-center gap-3 py-3"><input id={`recipe-purchased-${item.ingredient.id}`} aria-label={`Mark ${item.ingredient.name} as purchased`} type="checkbox" checked={itemChecked} onChange={() => onTogglePurchased(scope, item.ingredient.id)} className="no-print h-4 w-4" /><label htmlFor={`recipe-purchased-${item.ingredient.id}`} className="min-w-0 flex-1 text-sm text-slate-200"><span className={itemChecked ? 'line-through text-slate-500' : ''}>{number(item.grams, 1)} g {item.ingredient.name}</span><span className="ml-2 text-xs text-slate-500">{item.ingredient.measuredAs}</span></label><span className="shrink-0 text-xs text-slate-400">${item.costUsd.toFixed(2)} est.</span></li>;
    })}</ul></Card>) }
    <p className="text-xs text-slate-500">Purchase marks are scoped to this exact recipe-week selection and do not add anything to pantry inventory.</p>
  </section>;
}

export function RecipeWeekPrep(props: RecipeWeekOperationsProps) {
  const { plan, householdSize, prepCompleted, onHouseholdSize, onTogglePrep, onStatus } = props;
  const batches = useMemo(() => aggregateRecipePrep(plan.slots, plan.startDateKey, householdSize), [plan.slots, plan.startDateKey, householdSize]);
  const scope = recipeWeekScope(plan, householdSize);
  const complete = prepCompleted[scope] ?? [];
  return <section className="print-area space-y-5" aria-label="Recipe week batch prep">
    <Card title="Recipe Week Batch Prep" subtitle="Each batch uses the same measured recipe ingredients as your week and scales only for household preparation.">
      <div className="no-print flex flex-wrap items-end justify-between gap-3"><HouseholdControl householdSize={householdSize} onHouseholdSize={onHouseholdSize} onStatus={onStatus} /><div className="flex flex-wrap gap-2"><button type="button" className="btb-secondary text-xs" onClick={() => { downloadText('BTB-recipe-week-prep.csv', recipePrepCsv(plan, householdSize)); onStatus('Prep CSV downloaded.'); }}>Download prep CSV</button><button type="button" className="btb-secondary text-xs" onClick={() => { window.print(); onStatus('Print dialog opened for this prep sheet.'); }}>Print prep</button></div></div>
      <p className="mt-4 text-xs text-slate-400">Recipe times are estimates using ready-cooked grains where listed, not guaranteed batch timings. Refrigerate perishables within 2 hours (1 hour above 90°F), keep at 40°F or below, and use cooked leftovers within 3–4 days. Freeze later portions or prep again. Reheat cooked leftovers to 165°F using a thermometer. Follow product-specific storage directions.</p>
    </Card>
    {batches.length === 0 ? <div className="btb-empty"><p className="text-sm text-slate-400">No safe batches yet. Generate a recipe week first.</p></div> : batches.map((batch) => {
      const done = complete.includes(batch.recipe.id);
      const quantities = recipeIngredientQuantities(batch.recipe, batch.servings);
      return <Card key={batch.recipe.id} title={batch.recipe.name} subtitle={`${number(batch.servings, 1)} household servings · use ${batch.dates.join(', ')}`} className="break-inside-avoid">
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-300">Estimated: {batch.prepMinutes} min prep · {batch.cookMinutes} min cook</p><label className="no-print flex items-center gap-2 text-xs text-slate-300"><input aria-label={`Mark ${batch.recipe.name} as prepared`} type="checkbox" checked={done} onChange={() => onTogglePrep(scope, batch.recipe.id)} />{done ? 'Prepared' : 'Mark prepared'}</label></div>
        <details className="mt-4 rounded-lg bg-white/5 p-3"><summary className="cursor-pointer text-xs font-semibold text-slate-200">Measured batch ingredients</summary><ul className="mt-3 grid gap-1 text-xs text-slate-400 sm:grid-cols-2">{quantities.map((item) => <li key={item.ingredientId}>{number(item.grams, 1)} g {item.ingredient.name} ({item.ingredient.measuredAs})</li>)}</ul></details>
        <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-slate-300">{batch.recipe.instructions.map((instruction) => <li key={instruction}>{instruction}</li>)}</ol>
      </Card>;
    })}
    <p className="text-xs text-slate-500">Prep completion is scoped to this exact recipe-week selection and household size; changing recipes or scale starts a separate checklist. Storage guidance: USDA FSIS Leftovers and Food Safety (fsis.usda.gov).</p>
  </section>;
}
