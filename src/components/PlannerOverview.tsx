'use client';

import { useMemo } from 'react';
import { getActiveWeeklyPlan, useMealPlannerStore } from '@/store/useMealPlannerStore';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { calculateMetabolicSummary, getAdjustmentForDate } from '@/lib/fitnessMealPlanner';
import { calculateDailyNutritionTotals, getHydrationEntriesForDate } from '@/lib/nutritionLedger';
import { addDays, localDateKey } from '@/lib/dateKeys';
import { plannedNutrition } from '@/lib/premiumPlanner';
import Card from './ui/Card';

export type OverviewDestination = 'profile' | 'week' | 'prep' | 'shopping' | 'tracker' | 'foodLogger' | 'recipes';
export default function PlannerOverview({ navigate }: { navigate: (destination: OverviewDestination) => void }) {
  const profile = useMealPlannerStore((s) => s.profile);
  const weeklyPlan = useMealPlannerStore((s) => s.weeklyPlan);
  const foodCatalog = useMealPlannerStore((s) => s.foodCatalog);
  const loggedFoods = useMealPlannerStore((s) => s.loggedFoods);
  const hydrationLogs = useMealPlannerStore((s) => s.hydrationLogs);
  const savedRecipes = useMealPlannerStore((s) => s.savedRecipes);
  const adjustmentPlan = useMealPlannerStore((s) => s.calorieAdjustmentPlan);
  const household = useWorkspaceStore((s) => s.householdSize);
  const today = localDateKey();
  const summary = useMemo(() => calculateMetabolicSummary(profile), [profile]);
  const consumed = useMemo(() => calculateDailyNutritionTotals(loggedFoods, today, foodCatalog), [loggedFoods, today, foodCatalog]);
  const target = summary.targetCalories - getAdjustmentForDate(adjustmentPlan, today, summary.targetCalories);
  const hydration = useMemo(() => getHydrationEntriesForDate(hydrationLogs, today).reduce((sum, e) => sum + e.ounces, 0), [hydrationLogs, today]);
  const slots = useMemo(() => getActiveWeeklyPlan({ profile, foodCatalog, weeklyPlan }), [profile, foodCatalog, weeklyPlan]);
  const completeDays = new Set(slots.filter((s) => slots.filter((other) => other.day === s.day).length === 4).map((s) => s.day)).size;
  const planned = plannedNutrition(slots);
  const progress = Math.min(100, target > 0 ? consumed.calories / target * 100 : 0);
  const macros = [
    { label: 'Protein', value: consumed.proteinGrams, goal: summary.macroTargets.proteinGrams },
    { label: 'Carbs', value: consumed.carbGrams, goal: summary.macroTargets.carbGrams },
    { label: 'Fat', value: consumed.fatGrams, goal: summary.macroTargets.fatGrams },
  ];
  const nextSteps: { step: string; title: string; detail: string; destination: OverviewDestination }[] = [
    { step: '01', title: 'Set your foundation', detail: 'Goals, preferences, and dietary exclusions.', destination: 'profile' },
    { step: '02', title: 'Build the week', detail: 'Review seven days and personalize your portions.', destination: 'week' },
    { step: '03', title: 'Prep with purpose', detail: 'Batch quantities, checklist, and safe storage.', destination: 'prep' },
    { step: '04', title: 'Shop the plan', detail: 'Pantry-aware groceries and a household budget.', destination: 'shopping' },
  ];

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-surface-border bg-surface-card px-5 py-4">
      <div><p className="btb-eyebrow">YOUR NUTRITION OPERATIONS CENTER</p><p className="mt-1 text-sm text-slate-300">{weeklyPlan ? `Your saved week runs ${weeklyPlan.startDateKey} – ${addDays(weeklyPlan.startDateKey, 6)}.` : 'Start with your profile, then turn your next week into a plan.'}</p></div>
      <button className="btb-button" onClick={() => navigate('week')}>{weeklyPlan ? 'Open weekly plan' : 'Build my week'} <span aria-hidden="true">→</span></button>
    </div>
    <div className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
      <Card className="relative overflow-hidden" title="Today, by the numbers" subtitle="Actual food logged today—not food merely planned.">
        <div className="mt-3 flex items-end gap-3"><p className="font-display text-6xl font-semibold tracking-tight text-slate-100">{Math.round(consumed.calories).toLocaleString()}</p><p className="pb-2 text-sm text-slate-400">of {Math.round(target).toLocaleString()} kcal target</p></div>
        <div role="progressbar" aria-label="Today's calorie target progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} className="mt-5 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-accent" style={{ width: `${progress}%` }} /></div>
        <p className="mt-2 text-xs text-slate-400">{Math.abs(Math.round(target - consumed.calories)).toLocaleString()} kcal {consumed.calories > target ? 'above' : 'remaining to'} estimated target. Exercise is tracked separately.</p>
        <div className="mt-6 grid grid-cols-3 gap-4">{macros.map((macro) => <div key={macro.label}><p className="btb-eyebrow">{macro.label}</p><p className="mt-2 text-xl font-bold text-accent">{Math.round(macro.value)}<span className="text-xs font-normal text-slate-400"> / {Math.round(macro.goal)}g</span></p><div className="mt-2 h-1 rounded-full bg-white/10"><div className="h-full rounded-full bg-accent/65" style={{ width: `${Math.min(100, macro.value / macro.goal * 100)}%` }} /></div></div>)}</div>
        <div className="mt-6 flex flex-wrap gap-2"><button className="btb-button" onClick={() => navigate('foodLogger')}>Log food</button><button className="btb-secondary" onClick={() => navigate('tracker')}>Open nutrition tracker</button></div>
      </Card>
      <Card title="Your weekly workflow" subtitle="A repeatable system, not another diet to chase."><div className="space-y-1">{nextSteps.map((step) => <button key={step.step} onClick={() => navigate(step.destination)} className="group flex w-full items-center gap-4 rounded-lg px-2 py-3 text-left transition-colors hover:bg-white/5"><span className="font-mono text-xs text-accent">{step.step}</span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{step.title}</span><span className="mt-1 block text-xs text-slate-400">{step.detail}</span></span><span className="text-slate-500 group-hover:text-accent" aria-hidden="true">→</span></button>)}</div></Card>
    </div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <button className="btb-stat text-left transition-colors hover:border-accent/30" onClick={() => navigate('week')}><span className="btb-eyebrow">WEEK COVERAGE</span><p>{completeDays}<span className="text-lg text-slate-500"> / 7 days</span></p><span>{slots.length} selected meal windows</span></button>
      <button className="btb-stat text-left transition-colors hover:border-accent/30" onClick={() => navigate('tracker')}><span className="btb-eyebrow">HYDRATION TODAY</span><p>{Math.round(hydration)}<span className="text-lg text-slate-500"> oz</span></p><span>Open tracker to record water</span></button>
      <button className="btb-stat text-left transition-colors hover:border-accent/30" onClick={() => navigate('recipes')}><span className="btb-eyebrow">RECIPE LIBRARY</span><p>{savedRecipes.length}</p><span>Saved recipes in this browser</span></button>
      <button className="btb-stat text-left transition-colors hover:border-accent/30" onClick={() => navigate('shopping')}><span className="btb-eyebrow">HOUSEHOLD</span><p>{household}</p><span>Prep and grocery multiplier only</span></button>
    </div>
    <Card title="Planned is not consumed" subtitle="Keep intention and actual intake separate."><p className="text-sm text-slate-300">{slots.length ? `Your selected week contains approximately ${Math.round(planned.calories).toLocaleString()} kcal across ${slots.length} meal windows. Review each day's totals and adjust the portions; automatic selections do not guarantee balanced meals or meeting your targets.` : 'Your weekly plan is empty. Planned meals will appear here after you create a week; only logged foods count toward today’s intake.'}</p><p className="mt-3 text-xs text-slate-400">Nutrition and grocery values are estimates. Check labels and allergens, and consult a qualified professional for individualized needs.</p></Card>
  </div>;
}
