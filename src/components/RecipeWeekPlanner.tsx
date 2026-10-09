'use client';

import { useEffect, useMemo, useState } from 'react';
import { addDays, isDateKey, localDateKey, type DateKey } from '@/lib/dateKeys';
import { downloadText } from '@/lib/premiumPlanner';
import {
  RECIPE_DIET_PREFERENCES,
  RECIPE_INGREDIENT_BY_ID,
  RECIPE_MEALS,
  RECIPE_MEAL_BY_ID,
  RECIPE_MEAL_LABELS,
  RECIPE_MEAL_WINDOWS,
  RECIPE_NUTRITION_REFERENCE,
  RECIPE_TIME_OPTIONS,
  allowedRecipeWeekPlan,
  recipeNutrition,
  recipeWeekCsv,
  recipeWeekNutrition,
  safeRecipeCandidates,
  type RecipeDietPreference,
  type RecipeTimePreference,
  type RecipeWeekPreferences,
} from '@/lib/recipeMeals';
import { useMealPlannerStore } from '@/store/useMealPlannerStore';
import { useRecipeWeekStore } from '@/store/useRecipeWeekStore';
import RecipeMealCard from './RecipeMealCard';
import { RecipeWeekPrep, RecipeWeekShopping } from './RecipeWeekOperations';
import Card from './ui/Card';

const dietLabel: Record<RecipeDietPreference, string> = { balanced: 'Balanced', high_protein: 'High protein', vegetarian: 'Vegetarian', plant_based: 'Plant-based' };
type WorkspaceMode = 'week' | 'shopping' | 'prep';
type Status = { kind: 'success' | 'error'; message: string } | null;

function displayDate(value: DateKey): string { return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }); }
function number(value: number, places = 0): string { return (Math.round(value * 10 ** places) / 10 ** places).toLocaleString(); }
function lockKey(day: number, mealWindow: string): string { return `${day}:${mealWindow}`; }

export default function RecipeWeekPlanner() {
  const profile = useMealPlannerStore((state) => state.profile);
  const storedPlan = useRecipeWeekStore((state) => state.plan);
  const plan = useMemo(() => storedPlan ? allowedRecipeWeekPlan(storedPlan, profile) : null, [storedPlan, profile]);
  const favorites = useRecipeWeekStore((state) => state.favorites);
  const savedWeeks = useRecipeWeekStore((state) => state.savedWeeks);
  const lockedSlots = useRecipeWeekStore((state) => state.lockedSlots);
  const purchased = useRecipeWeekStore((state) => state.purchased);
  const prepCompleted = useRecipeWeekStore((state) => state.prepCompleted);
  const householdSize = useRecipeWeekStore((state) => state.householdSize);
  const generateRecipeWeek = useRecipeWeekStore((state) => state.generateRecipeWeek);
  const regenerateUnlocked = useRecipeWeekStore((state) => state.regenerateUnlocked);
  const swapRecipe = useRecipeWeekStore((state) => state.swapRecipe);
  const setRecipeServings = useRecipeWeekStore((state) => state.setRecipeServings);
  const toggleLock = useRecipeWeekStore((state) => state.toggleLock);
  const toggleFavorite = useRecipeWeekStore((state) => state.toggleFavorite);
  const saveWeek = useRecipeWeekStore((state) => state.saveWeek);
  const loadWeek = useRecipeWeekStore((state) => state.loadWeek);
  const setHouseholdSize = useRecipeWeekStore((state) => state.setHouseholdSize);
  const togglePurchased = useRecipeWeekStore((state) => state.togglePurchased);
  const togglePrep = useRecipeWeekStore((state) => state.togglePrep);
  const [mode, setMode] = useState<WorkspaceMode>('week');
  const [activeDay, setActiveDay] = useState(1);
  const [weekName, setWeekName] = useState('');
  const [savedWeekId, setSavedWeekId] = useState('');
  const [status, setStatus] = useState<Status>(null);
  const [preferences, setPreferences] = useState<RecipeWeekPreferences>({ startDateKey: localDateKey(), diet: 'balanced', maxTotalMinutes: 30 });

  useEffect(() => { if (plan) setPreferences(plan.preferences); }, [plan]);
  useEffect(() => { if (!savedWeeks.some((week) => week.id === savedWeekId)) setSavedWeekId(savedWeeks[0]?.id ?? ''); }, [savedWeekId, savedWeeks]);

  const notify = (message: string, kind: 'success' | 'error' = 'success') => setStatus({ kind, message });
  const run = (action: () => void, success: string) => {
    try { action(); notify(success); } catch (cause) { notify(cause instanceof Error ? cause.message : 'That recipe-week action could not be completed.', 'error'); }
  };
  const updatePreference = <K extends keyof RecipeWeekPreferences>(key: K, value: RecipeWeekPreferences[K]) => setPreferences((current) => ({ ...current, [key]: value }));
  const build = () => run(() => {
    if (!isDateKey(preferences.startDateKey)) throw new Error('Choose a valid start date.');
    generateRecipeWeek(profile, preferences);
    setActiveDay(1); setMode('week');
  }, 'Your recipe week is ready. Review every serving and recipe before shopping.');

  const activeSlots = useMemo(() => plan?.slots.filter((slot) => slot.day === activeDay) ?? [], [activeDay, plan]);
  const activeNutrition = useMemo(() => recipeWeekNutrition(activeSlots), [activeSlots]);
  const weeklyNutrition = useMemo(() => plan ? recipeWeekNutrition(plan.slots) : null, [plan]);
  const favoriteNames = favorites.map((id) => RECIPE_MEAL_BY_ID[id]?.name).filter(Boolean);

  const renderWeek = () => {
    if (!plan) return <FirstPlanSetup preferences={preferences} updatePreference={updatePreference} onBuild={build} />;
    const date = addDays(plan.startDateKey, activeDay - 1);
    return <section className="recipe-plan-screen print-area space-y-5" aria-label="Recipe week plan">
      <Card title="Your complete recipe week" subtitle="Generated recipes are a practical starting selection. They are not automatically logged or a guarantee of meeting calorie or macro targets.">
        <div className="no-print flex flex-wrap items-end justify-between gap-3"><div className="flex flex-wrap gap-2"><button type="button" className="btb-button text-xs" onClick={() => run(() => regenerateUnlocked(profile), 'Unlocked meals were regenerated using your current dietary and time safeguards.')}>Regenerate unlocked</button><button type="button" className="btb-secondary text-xs" onClick={() => { downloadText('BTB-recipe-week.csv', recipeWeekCsv(plan)); notify('Recipe-week CSV downloaded.'); }}>Download week CSV</button><button type="button" className="btb-secondary text-xs" onClick={() => { window.print(); notify('Print dialog opened for the complete recipe week.'); }}>Print week</button></div><p className="text-xs text-slate-400">{plan.startDateKey} – {addDays(plan.startDateKey, 6)} · {plan.slots.length}/28 safe selections</p></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3"><label className="no-print text-xs text-slate-300">Diet preference<select aria-label="Recipe diet preference" className="input mt-1" value={preferences.diet} onChange={(event) => updatePreference('diet', event.target.value as RecipeDietPreference)}>{RECIPE_DIET_PREFERENCES.map((diet) => <option key={diet} value={diet}>{dietLabel[diet]}</option>)}</select></label><label className="no-print text-xs text-slate-300">Maximum total recipe time<select aria-label="Recipe time preference" className="input mt-1" value={preferences.maxTotalMinutes} onChange={(event) => updatePreference('maxTotalMinutes', Number(event.target.value) as RecipeTimePreference)}>{RECIPE_TIME_OPTIONS.map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes or less</option>)}</select></label><label className="no-print text-xs text-slate-300">Start date<input aria-label="Recipe week start date" type="date" className="input mt-1" value={preferences.startDateKey} onChange={(event) => updatePreference('startDateKey', event.target.value as DateKey)} /></label></div>
        <p className="no-print mt-3 text-xs text-slate-400">Change filters then select <strong className="text-slate-200">Build a new recipe week</strong> below to apply them. Allergens, custom exclusions, GI triggers, and spice safeguards are always checked.</p>
        <div className="no-print mt-3 flex flex-wrap gap-2"><button type="button" className="btb-secondary text-xs" onClick={build}>Build a new recipe week</button><label className="flex min-w-52 flex-1 items-end gap-2 text-xs text-slate-300">Save this week as<input aria-label="Recipe week name" className="input min-w-0" value={weekName} onChange={(event) => setWeekName(event.target.value)} placeholder="e.g. Busy week" /></label><button type="button" className="btb-secondary text-xs" onClick={() => run(() => saveWeek(weekName), `Saved “${weekName.trim()}” in this browser.`)}>Save named week</button></div>
        {savedWeeks.length > 0 && <div className="no-print mt-3 flex flex-wrap items-end gap-2 border-t border-surface-border pt-3"><label className="min-w-52 flex-1 text-xs text-slate-300">Load a saved week<select aria-label="Load named recipe week" className="input mt-1" value={savedWeekId} onChange={(event) => setSavedWeekId(event.target.value)}>{savedWeeks.map((week) => <option key={week.id} value={week.id}>{week.name} · {week.plan.startDateKey}</option>)}</select></label><button type="button" className="btb-secondary text-xs" onClick={() => run(() => loadWeek(savedWeekId, profile), 'Saved week loaded and rechecked against your current safeguards.')}>Load safely</button></div>}
      </Card>
      <div className="no-print flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Recipe plan days">{Array.from({ length: 7 }, (_, index) => { const day = index + 1; const dayDate = addDays(plan.startDateKey, index); const count = plan.slots.filter((slot) => slot.day === day).length; return <button type="button" role="tab" aria-selected={day === activeDay} key={day} className={`shrink-0 rounded-lg border px-3 py-2 text-left text-xs ${day === activeDay ? 'border-accent bg-accent/10 text-accent' : 'border-surface-border text-slate-300 hover:bg-white/5'}`} onClick={() => setActiveDay(day)}><span className="block font-mono">DAY {day}</span><span className="block pt-1">{displayDate(dayDate)}</span><span className="block pt-1 text-[10px] text-slate-500">{count}/4 meals</span></button>; })}</div>
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border border-surface-border bg-surface-card px-5 py-4"><div><p className="btb-eyebrow text-accent">DAY {String(activeDay).padStart(2, '0')} · {displayDate(date)}</p><p className="mt-1 text-sm text-slate-300">Personal planned nutrition from the measured ingredient quantities.</p></div><div className="text-right"><p className="font-display text-3xl text-slate-100">{number(activeNutrition.calories)} <span className="text-sm text-slate-400">kcal</span></p><p className="text-xs text-slate-400">P {number(activeNutrition.proteinGrams)}g · C {number(activeNutrition.carbGrams)}g · F {number(activeNutrition.fatGrams)}g</p></div></div>
      <div className="space-y-4">{RECIPE_MEAL_WINDOWS.map((mealWindow) => {
        const slot = activeSlots.find((candidate) => candidate.mealWindow === mealWindow);
        const candidates = safeRecipeCandidates(profile, plan.preferences, mealWindow);
        if (!slot) return <div key={mealWindow} className="rounded-xl border border-dashed border-accent-amber/40 bg-accent-amber/5 p-5"><p className="btb-eyebrow text-accent-amber">{RECIPE_MEAL_LABELS[mealWindow]}</p><h3 className="mt-2 font-semibold text-slate-100">No safe choice with these filters</h3><p className="mt-1 text-sm text-slate-400">No recipe met your dietary/GI safeguards and {plan.preferences.maxTotalMinutes}-minute {dietLabel[plan.preferences.diet].toLowerCase()} filter. Broaden diet or time preferences, or update your profile only if it is accurate.</p></div>;
        const recipe = RECIPE_MEAL_BY_ID[slot.recipeId];
        return <RecipeMealCard key={`${activeDay}-${mealWindow}`} slot={slot} date={date} profile={profile} candidates={candidates} locked={lockedSlots.includes(lockKey(activeDay, mealWindow))} favorite={favorites.includes(recipe.id)} onSwap={(recipeId) => run(() => swapRecipe(profile, activeDay, mealWindow, recipeId), 'Meal swapped. The recipe details, nutrition, groceries, and prep list now use the new measured ingredients.')} onServings={(servings) => run(() => setRecipeServings(activeDay, mealWindow, servings), 'Personal serving quantity updated.')} onLock={() => run(() => toggleLock(activeDay, mealWindow), lockedSlots.includes(lockKey(activeDay, mealWindow)) ? 'Meal unlocked for regeneration.' : 'Meal locked and will be kept during regeneration.')} onFavorite={() => run(() => toggleFavorite(recipe.id), favorites.includes(recipe.id) ? 'Removed from favorites.' : 'Added to favorites.')} onStatus={notify} />;
      })}</div>
      <RecipeWeekPrint plan={plan} />
      <Card title="Measured-estimate disclosure" subtitle="Use the recipe details and product labels to make final choices."><p className="text-sm text-slate-300">{RECIPE_NUTRITION_REFERENCE} Household scaling applies only to shopping and batch prep. The current plan estimates {number(weeklyNutrition?.calories ?? 0)} kcal across its selected recipe servings; this is planned food, not consumption.</p><p className="mt-2 text-xs text-slate-400">Existing photos are ingredient illustrations, not plated meal photos or measured-serving representations. Check allergens and cross-contact before preparing or eating.</p></Card>
    </section>;
  };

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/25 bg-accent/5 px-5 py-4"><div><p className="btb-eyebrow text-accent">COMPLETE RECIPES / LOCAL WORKSPACE</p><h2 className="mt-1 text-2xl font-bold text-slate-100">Recipe Week</h2><p className="mt-1 text-sm text-slate-400">Cookable measured recipes, practical safeguards, and no automatic intake logging.</p></div>{plan && <div className="no-print flex rounded-lg border border-surface-border p-1" role="tablist" aria-label="Recipe week workspace views">{([{ id: 'week', label: 'Plan' }, { id: 'shopping', label: 'Shopping' }, { id: 'prep', label: 'Batch prep' }] as const).map((item) => <button type="button" role="tab" aria-selected={mode === item.id} key={item.id} className={`rounded-md px-3 py-2 text-xs font-semibold ${mode === item.id ? 'bg-accent text-black' : 'text-slate-300 hover:bg-white/5'}`} onClick={() => setMode(item.id)}>{item.label}</button>)}</div>}</div>
    {status && <p role={status.kind === 'error' ? 'alert' : 'status'} className={`rounded-lg border px-4 py-3 text-sm ${status.kind === 'error' ? 'border-accent-red/30 bg-accent-red/10 text-accent-red' : 'border-accent/30 bg-accent/10 text-slate-100'}`}>{status.message}</p>}
    {plan && storedPlan && plan.slots.length < storedPlan.slots.length && <p role="status" className="rounded-lg border border-accent-amber/30 bg-accent-amber/10 p-3 text-sm text-accent-amber">Some saved choices no longer match your current safeguards. They are excluded from this view, groceries, prep, and exports. Regenerate to fill allowed meals; missing safe choices remain visible.</p>}
    {favorites.length > 0 && <p className="no-print text-xs text-slate-400"><strong className="text-slate-200">Favorites:</strong> {favoriteNames.join(' · ')}</p>}
    {!plan || mode === 'week' ? renderWeek() : mode === 'shopping' ? <RecipeWeekShopping plan={plan} householdSize={householdSize} purchased={purchased} prepCompleted={prepCompleted} onHouseholdSize={setHouseholdSize} onTogglePurchased={togglePurchased} onTogglePrep={togglePrep} onStatus={notify} /> : <RecipeWeekPrep plan={plan} householdSize={householdSize} purchased={purchased} prepCompleted={prepCompleted} onHouseholdSize={setHouseholdSize} onTogglePurchased={togglePurchased} onTogglePrep={togglePrep} onStatus={notify} />}
  </div>;
}

function FirstPlanSetup({ preferences, updatePreference, onBuild }: { preferences: RecipeWeekPreferences; updatePreference: <K extends keyof RecipeWeekPreferences>(key: K, value: RecipeWeekPreferences[K]) => void; onBuild: () => void }) {
  return <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]"><Card title="Build your first recipe week" subtitle="Pick a practical filter first. We will only place recipes that clear your current profile safeguards."><div className="grid gap-4 sm:grid-cols-3"><label className="text-sm text-slate-300">Start date<input aria-label="First recipe week start date" type="date" className="input mt-1" value={preferences.startDateKey} onChange={(event) => updatePreference('startDateKey', event.target.value as DateKey)} /></label><label className="text-sm text-slate-300">Diet preference<select aria-label="First recipe diet preference" className="input mt-1" value={preferences.diet} onChange={(event) => updatePreference('diet', event.target.value as RecipeDietPreference)}>{RECIPE_DIET_PREFERENCES.map((diet) => <option key={diet} value={diet}>{dietLabel[diet]}</option>)}</select></label><label className="text-sm text-slate-300">Recipe time<select aria-label="First recipe time preference" className="input mt-1" value={preferences.maxTotalMinutes} onChange={(event) => updatePreference('maxTotalMinutes', Number(event.target.value) as RecipeTimePreference)}>{RECIPE_TIME_OPTIONS.map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes or less</option>)}</select></label></div><button type="button" className="btb-button mt-5" onClick={onBuild}>Generate my recipe week <span aria-hidden="true">→</span></button><p className="mt-3 text-xs text-slate-400">Allergen and custom-exclusion matches are blocked. GI and spice triggers are also kept out of automatic recipe selections. If no safe option exists, the plan leaves an honest gap instead of substituting a trigger.</p></Card><Card title="How it works" subtitle="A simple kitchen workflow, not a subscription."><ol className="space-y-4 text-sm text-slate-300"><li><span className="mr-3 font-mono text-accent">01</span>Choose a start date, diet, and time limit.</li><li><span className="mr-3 font-mono text-accent">02</span>Review measured ingredients, yield, instructions, and nutrition for each day.</li><li><span className="mr-3 font-mono text-accent">03</span>Lock favorite meals, then build household-scaled shopping and prep lists.</li><li><span className="mr-3 font-mono text-accent">04</span>Only log a recipe when you eat it, to the local date you choose.</li></ol></Card></div>;
}

function RecipeWeekPrint({ plan }: { plan: NonNullable<ReturnType<typeof useRecipeWeekStore.getState>['plan']> }) {
  return <section className="hidden print:block" aria-label="Complete printable recipe week"><h2>BTB Meal Planner — Recipe Week</h2><p>{plan.startDateKey} – {addDays(plan.startDateKey, 6)}. Personal servings; nutrition and cost are estimates. Check labels and allergens.</p>{Array.from({ length: 7 }, (_, index) => { const day = index + 1; return <article key={day} className="mt-5"><h3>Day {day} — {displayDate(addDays(plan.startDateKey, index))}</h3>{plan.slots.filter((slot) => slot.day === day).map((slot) => { const recipe = RECIPE_MEAL_BY_ID[slot.recipeId]; const nutrition = recipeNutrition(recipe, slot.servings); return <div key={`${slot.day}-${slot.mealWindow}`} className="mt-3"><h4>{RECIPE_MEAL_LABELS[slot.mealWindow]}: {recipe.name} ({number(slot.servings, 2)} serving{slot.servings === 1 ? '' : 's'})</h4><p>{number(nutrition.calories)} kcal · P {number(nutrition.proteinGrams)}g · C {number(nutrition.carbGrams)}g · F {number(nutrition.fatGrams)}g</p><p><strong>Ingredients:</strong> {recipe.ingredients.map((item) => `${number(item.grams * slot.servings / recipe.yieldServings, 1)} g ${RECIPE_INGREDIENT_BY_ID[item.ingredientId]?.name ?? item.ingredientId} (${RECIPE_INGREDIENT_BY_ID[item.ingredientId]?.measuredAs ?? 'measured'})`).join(', ')}</p><ol>{recipe.instructions.map((instruction) => <li key={instruction}>{instruction}</li>)}</ol></div>; })}</article>; })}</section>;
}
