'use client';

import { useMemo, useState } from 'react';
import { getActiveWeeklyPlan, useMealPlannerStore } from '@/store/useMealPlannerStore';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { buildPrepBatches, planFingerprint, storageGuidance, FOOD_SAFETY_URL, MEAL_LABELS } from '@/lib/premiumPlanner';
import { localDateKey, type DateKey } from '@/lib/dateKeys';
import Card from './ui/Card';

const SESSION_TASKS = [
  { id: 'shop', label: 'Check pantry and shop the missing portions' },
  { id: 'clean', label: 'Clean work surfaces and separate raw proteins' },
  { id: 'containers', label: 'Set out clean, shallow storage containers' },
  { id: 'label', label: 'Label containers with food and preparation date' },
  { id: 'chill', label: 'Refrigerate promptly; freeze later-week portions' },
];

export default function MealPrepHub({ onOpenPlan, onOpenShopping }: { onOpenPlan: () => void; onOpenShopping: () => void }) {
  const profile = useMealPlannerStore((s) => s.profile);
  const foodCatalog = useMealPlannerStore((s) => s.foodCatalog);
  const weeklyPlan = useMealPlannerStore((s) => s.weeklyPlan);
  const householdSize = useWorkspaceStore((s) => s.householdSize);
  const sessions = useWorkspaceStore((s) => s.prepSessions);
  const updatePrep = useWorkspaceStore((s) => s.updatePrep);
  const togglePrep = useWorkspaceStore((s) => s.togglePrep);
  const [error, setError] = useState('');
  const slots = useMemo(() => getActiveWeeklyPlan({ profile, foodCatalog, weeklyPlan }), [profile, foodCatalog, weeklyPlan]);
  const key = useMemo(() => planFingerprint(weeklyPlan?.startDateKey, slots, householdSize), [weeklyPlan, slots, householdSize]);
  const session = sessions[key] ?? { date: localDateKey(), notes: '', completed: [] };
  const batches = useMemo(() => weeklyPlan ? buildPrepBatches(slots, weeklyPlan.startDateKey, householdSize) : [], [weeklyPlan, slots, householdSize]);
  const taskIds = [...SESSION_TASKS.map((t) => t.id), ...batches.map((b) => `food:${b.foodId}`)];
  const finished = taskIds.filter((id) => session.completed.includes(id)).length;
  const minutes = batches.reduce((sum, b) => sum + b.prepMinutes + b.cookMinutes, 0);
  const setPrepDate = (date: string) => {
    try { updatePrep(key, { date }); setError(''); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Choose a valid prep date.'); }
  };

  return <div className="space-y-6">
    <Card title="Prep with purpose" subtitle="One checklist, built from your actual plan. Household quantities never multiply your personal food log.">
      <div className="flex flex-wrap items-end gap-4">
        <label className="text-sm text-slate-300">Preparation date<input aria-label="Preparation date" type="date" className="input mt-1" value={session.date} onChange={(e) => setPrepDate(e.target.value)} /></label>
        <div><p className="btb-eyebrow">HOUSEHOLD</p><p className="mt-2 text-xl font-bold">{householdSize} {householdSize === 1 ? 'person' : 'people'}</p></div>
        <div className="no-print flex gap-2 sm:ml-auto"><button className="btb-secondary" onClick={onOpenShopping}>Open shopping list</button><button className="btb-secondary" disabled={!batches.length} onClick={() => { try { window.print(); } catch { setError('Use your browser print command to print the prep sheet.'); } }}>Print prep sheet</button></div>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-accent-red">{error}</p>}
    </Card>
    {!batches.length ? <div className="btb-empty"><span className="btb-eyebrow">MAKE A PLAN FIRST</span><h3 className="mt-3 text-2xl font-bold">Your kitchen workflow starts with a week.</h3><p className="mt-2 text-slate-400">Add meals to your seven-day plan to create a real prep list.</p><button className="btb-button mt-5" onClick={onOpenPlan}>Build my week</button></div> : (
      <section className="print-area space-y-6" aria-label="Meal preparation sheet">
        <div className="hidden print:block"><h2>BTB Meal Prep — {session.date}</h2><p>Household: {householdSize}. Quantities are estimated catalog portions.</p></div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="btb-stat"><span className="btb-eyebrow">PREP ITEMS</span><p>{batches.length}</p><span>Unique planned foods</span></div>
          <div className="btb-stat"><span className="btb-eyebrow">PLANNED PORTIONS</span><p>{batches.reduce((sum, b) => sum + b.servings, 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</p><span>Scaled for {householdSize} {householdSize === 1 ? 'person' : 'people'}</span></div>
          <div className="btb-stat"><span className="btb-eyebrow">CHECKLIST</span><p>{finished}/{taskIds.length}</p><span>Completed steps</span></div>
        </div>
        <Card title="Your session checklist" subtitle="Checkmarks stay with this plan and household quantity. Changed meals create a fresh checklist.">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-accent" style={{ width: `${finished / taskIds.length * 100}%` }} /></div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">{SESSION_TASKS.map((task) => <label key={task.id} className="flex items-start gap-3 text-sm"><input type="checkbox" checked={session.completed.includes(task.id)} onChange={() => togglePrep(key, task.id)} className="mt-1 h-4 w-4 accent-accent" /><span className={session.completed.includes(task.id) ? 'text-slate-500 line-through' : 'text-slate-200'}>{task.label}</span></label>)}</div>
        </Card>
        <div className="space-y-3">{batches.map((batch) => {
          const task = `food:${batch.foodId}`;
          return <article key={batch.foodId} className="rounded-xl border border-surface-border bg-surface-card p-5">
            <div className="flex items-start gap-3"><input aria-label={`Mark ${batch.name} as prepared`} type="checkbox" checked={session.completed.includes(task)} onChange={() => togglePrep(key, task)} className="mt-1.5 h-4 w-4 accent-accent" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><h3 className={`font-semibold ${session.completed.includes(task) ? 'text-slate-500 line-through' : 'text-slate-100'}`}>{batch.name}</h3><span className="rounded-md border border-accent/20 bg-accent/10 px-2 py-1 text-xs font-semibold text-accent">{batch.servings.toLocaleString(undefined, { maximumFractionDigits: 2 })} portions</span></div><p className="mt-2 text-sm text-slate-400">Per portion: {batch.portionRaw} before preparation → {batch.portionCooked} after preparation.</p><p className="mt-2 text-xs text-slate-400">Suggested method: {batch.method.replace(/_/g, ' ')} · Catalog estimate: {batch.prepMinutes} min prep + {batch.cookMinutes} min cooking. Larger batches and equipment can take longer.</p><p className="mt-2 text-xs text-slate-400">Measure the listed amount for each portion; no ingredient weight is inferred from a recipe name.</p>
              <div className="mt-3 space-y-1.5">{batch.uses.map((use) => <div key={`${use.day}-${use.mealWindow}`} className="rounded-md bg-white/5 px-3 py-2 text-xs"><span className="font-semibold text-slate-200">{use.date} · {MEAL_LABELS[use.mealWindow]}</span><span className="mt-1 block text-slate-400">{storageGuidance(session.date as DateKey, use.date, batch.method)}</span></div>)}</div>
            </div></div>
          </article>;
        })}</div>
        <Card title="Session notes" subtitle="Your container labels, seasoning ideas, equipment, and next-session reminders."><textarea aria-label="Meal prep notes" className="input min-h-28" maxLength={5000} value={session.notes} onChange={(e) => updatePrep(key, { notes: e.target.value })} placeholder="Example: keep dressing separate; prepare the second batch midweek." /><p className="mt-2 text-xs text-slate-500">Saved in this browser. Sequential catalog prep/cook estimate: {minutes} minutes before batch-size changes; not a timed kitchen schedule.</p></Card>
      </section>
    )}
    <Card title="Store smart. Reheat safely." subtitle="General USDA guidance—not a guarantee of safety for a particular food or storage history.">
      <div className="grid gap-4 md:grid-cols-3"><div><p className="text-lg font-bold text-accent">2 hours</p><p className="mt-1 text-sm text-slate-400">Refrigerate perishables within two hours, or one hour above 90°F. Divide large batches into shallow containers.</p></div><div><p className="text-lg font-bold text-accent">3–4 days</p><p className="mt-1 text-sm text-slate-400">Keep cooked leftovers at 40°F or below. Freeze later-week portions promptly or cook a second session.</p></div><div><p className="text-lg font-bold text-accent">165°F</p><p className="mt-1 text-sm text-slate-400">Reheat leftovers to 165°F using a thermometer. Thaw safely in the refrigerator, cold water, or microwave.</p></div></div><a href={FOOD_SAFETY_URL} target="_blank" rel="noreferrer" className="mt-4 inline-block text-xs text-accent underline">Read USDA leftovers and food safety guidance ↗</a>
    </Card>
  </div>;
}
