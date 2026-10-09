'use client';

import { useMemo, useState } from 'react';
import { getActiveWeeklyPlan, useMealPlannerStore } from '@/store/useMealPlannerStore';
import { addDays, localDateKey, type DateKey } from '@/lib/dateKeys';
import { calculateMetabolicSummary, evaluateDietarySafety, type MealWindow } from '@/lib/fitnessMealPlanner';
import { MEAL_WINDOWS, MEAL_LABELS, plannedNutrition, downloadText, weeklyPlanCsv } from '@/lib/premiumPlanner';
import Card from './ui/Card';

export default function WeeklyPlanner({ onOpenDaily, onOpenPrep }: { onOpenDaily: () => void; onOpenPrep: () => void }) {
  const profile = useMealPlannerStore((s) => s.profile);
  const foodCatalog = useMealPlannerStore((s) => s.foodCatalog);
  const weeklyPlan = useMealPlannerStore((s) => s.weeklyPlan);
  const generateWeeklyPlan = useMealPlannerStore((s) => s.generateWeeklyPlan);
  const substitute = useMealPlannerStore((s) => s.substituteWeeklyPlanSlot);
  const copyDay = useMealPlannerStore((s) => s.copyWeeklyPlanDay);
  const slots = useMemo(() => getActiveWeeklyPlan({ profile, foodCatalog, weeklyPlan }), [profile, foodCatalog, weeklyPlan]);
  const target = useMemo(() => calculateMetabolicSummary(profile), [profile]);
  const [startDate, setStartDate] = useState(weeklyPlan?.startDateKey ?? localDateKey());
  const [sourceDay, setSourceDay] = useState(1);
  const [targetDay, setTargetDay] = useState(2);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const run = (action: () => void, message: string) => {
    try { action(); setError(''); setNotice(message); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to update this plan.'); }
  };
  const changeSlot = (day: number, window: MealWindow, foodId: string, servings: number) => run(() => substitute(day, window, foodId, servings), 'Plan updated. Meal prep and groceries use this same selection.');

  return (
    <div className="space-y-6">
      <Card title="Build your seven-day blueprint" subtitle="A flexible starting selection, not a guarantee of meeting your calorie or macro targets.">
        <div className="no-print flex flex-wrap items-end gap-3">
          <label htmlFor="week-start" className="text-sm text-slate-300">Plan starts
            <input id="week-start" type="date" className="input mt-1" value={startDate} onChange={(e) => setStartDate(e.target.value as DateKey)} />
          </label>
          <button className="btb-button" onClick={() => run(() => generateWeeklyPlan({ startDateKey: startDate }), 'Your seven-day plan is ready. Review the meals and adjust portions to suit your needs.')}>{weeklyPlan ? 'Build a new week' : 'Generate my week'}</button>
          <button className="btb-secondary" onClick={onOpenDaily}>Open daily details</button>
          <button className="btb-secondary" onClick={onOpenPrep}>Create prep checklist</button>
        </div>
        {weeklyPlan && <p className="mt-3 text-xs text-slate-400">Saved week: {weeklyPlan.startDateKey} – {addDays(weeklyPlan.startDateKey, 6)}. Building a new week replaces its selections, not your food logs or recipes.</p>}
        {error && <p role="alert" className="mt-3 text-sm text-accent-red">{error}</p>}
        {notice && <p role="status" className="mt-3 text-sm text-accent">{notice}</p>}
      </Card>
      {!weeklyPlan ? <div className="btb-empty"><span className="btb-eyebrow">PLAN / PREP / REPEAT</span><h3 className="mt-3 text-2xl font-bold">Your next week starts here.</h3><p className="mt-2 text-slate-400">Set your profile and dietary exclusions, then generate a week. Adjust each selection before shopping.</p></div> : (
        <>
          <div className="no-print flex flex-wrap items-end gap-3 rounded-xl border border-surface-border p-4">
            <label className="text-xs text-slate-300">Copy from
              <select aria-label="Copy from plan day" value={sourceDay} onChange={(e) => setSourceDay(Number(e.target.value))} className="input mt-1">{[1, 2, 3, 4, 5, 6, 7].map((d) => <option key={d} value={d}>Day {d}</option>)}</select>
            </label>
            <label className="text-xs text-slate-300">Copy to
              <select aria-label="Copy to plan day" value={targetDay} onChange={(e) => setTargetDay(Number(e.target.value))} className="input mt-1">{[1, 2, 3, 4, 5, 6, 7].map((d) => <option key={d} value={d}>Day {d}</option>)}</select>
            </label>
            <button className="btb-secondary" onClick={() => run(() => copyDay(sourceDay, targetDay), `Day ${sourceDay} copied to Day ${targetDay}. Other days were kept.`)}>Copy day selections</button>
            <div className="flex flex-wrap gap-2 sm:ml-auto">
              <button className="btb-secondary" onClick={() => run(() => downloadText('BTB-weekly-plan.csv', weeklyPlanCsv(slots, weeklyPlan.startDateKey)), 'Weekly CSV exported.')}>Export CSV</button>
              <button className="btb-secondary" onClick={() => run(() => window.print(), 'Print dialog opened.')}>Print week</button>
            </div>
          </div>
          <section className="print-area space-y-4" aria-label="Seven-day meal plan">
            <div className="hidden print:block"><h2>BTB Meal Planner — {weeklyPlan.startDateKey}</h2><p>Personal servings. Estimated cooked nutrition; check labels and your individual targets.</p></div>
            {Array.from({ length: 7 }, (_, i) => {
              const day = i + 1;
              const daySlots = slots.filter((s) => s.day === day);
              const totals = plannedNutrition(daySlots);
              const difference = Math.round(totals.calories - target.targetCalories);
              const date = addDays(weeklyPlan.startDateKey, i);
              return <article key={day} className="overflow-hidden rounded-xl border border-surface-border bg-surface-card">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border px-5 py-4">
                  <div><span className="btb-eyebrow">DAY {String(day).padStart(2, '0')}</span><h3 className="mt-1 font-bold text-slate-100">{new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</h3></div>
                  <div className="text-right"><p className="text-xl font-bold text-accent">{Math.round(totals.calories).toLocaleString()} <span className="text-xs text-slate-400">kcal planned</span></p><p className="text-xs text-slate-400">P {Math.round(totals.proteinGrams)}g · C {Math.round(totals.carbGrams)}g · F {Math.round(totals.fatGrams)}g</p><p className={`mt-1 text-xs ${Math.abs(difference) > 150 ? 'text-accent-amber' : 'text-slate-400'}`}>{Math.abs(difference)} kcal {difference >= 0 ? 'above' : 'below'} estimated target · {daySlots.length}/4 windows</p></div>
                </div>
                <div className="grid gap-px bg-surface-border sm:grid-cols-2 xl:grid-cols-4">
                  {MEAL_WINDOWS.map((window) => {
                    const slot = daySlots.find((s) => s.mealWindow === window);
                    const candidates = foodCatalog.filter((food) => food.mealWindows.includes(window) && !evaluateDietarySafety(food, profile).hardBlocked);
                    const warnings = slot ? evaluateDietarySafety(slot.food, profile).warnings : [];
                    return <div key={window} className="min-w-0 bg-surface-card p-4">
                      <p className="btb-eyebrow">{MEAL_LABELS[window]}</p>
                      <p className="mt-2 min-h-10 text-sm font-semibold">{slot?.food.name ?? 'No allowed selection'}</p>
                      {slot && <p className="mt-1 text-xs text-slate-400">{slot.servings ?? 1} × {slot.food.portionCooked}</p>}
                      <div className="no-print mt-3 space-y-2">
                        <label className="sr-only" htmlFor={`week-${day}-${window}-food`}>{MEAL_LABELS[window]} on Day {day}</label>
                        <select id={`week-${day}-${window}-food`} className="input text-xs" value={slot?.food.id ?? ''} onChange={(e) => changeSlot(day, window, e.target.value, slot?.servings ?? 1)} disabled={!candidates.length}>
                          <option value="" disabled>Choose a food</option>{candidates.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                        {slot && <label className="flex items-center gap-2 text-xs text-slate-400">Personal servings
                          <input aria-label={`Servings for Day ${day} ${MEAL_LABELS[window]}`} type="number" min="0.25" max="100" step="0.25" value={slot.servings ?? 1} onChange={(e) => changeSlot(day, window, slot.food.id, Number(e.target.value))} className="input max-w-20" />
                        </label>}
                      </div>
                      {warnings.map((warning) => <p key={warning.label} className="mt-2 text-xs text-accent-amber">{warning.label}</p>)}
                    </div>;
                  })}
                </div>
              </article>;
            })}
          </section>
        </>
      )}
    </div>
  );
}
