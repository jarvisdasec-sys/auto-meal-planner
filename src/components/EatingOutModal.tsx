'use client';

import { useMemo, useState } from 'react';
import { RESTAURANT_CHAINS, findBestRestaurantChoice, type RestaurantMenuItem } from '@/lib/restaurantMenu';
import { calculateSmoothAdjustment, type SmoothAdjustmentPlan } from '@/lib/fitnessMealPlanner';
import Modal from './ui/Modal';

interface EatingOutModalProps {
  open: boolean;
  onClose: () => void;
  remainingCalories: number;
  /** Receives the untouched menu nutrition (including P/C/F) and a dated next-day adjustment plan. */
  onLogMeal: (item: RestaurantMenuItem, adjustmentPlan: SmoothAdjustmentPlan | null) => void;
}

export default function EatingOutModal({ open, onClose, remainingCalories, onLogMeal }: EatingOutModalProps) {
  const [chainId, setChainId] = useState(RESTAURANT_CHAINS[0].id);
  const [error, setError] = useState<string | null>(null);
  const chain = RESTAURANT_CHAINS.find((candidate) => candidate.id === chainId) ?? RESTAURANT_CHAINS[0];
  const bestChoice = useMemo(() => findBestRestaurantChoice(chain.items, remainingCalories), [chain.items, remainingCalories]);

  const handleLog = (item: RestaurantMenuItem) => {
    try {
      const excess = item.calories - remainingCalories;
      // Shared calculator dates any overage from tomorrow through its inclusive end date.
      const adjustmentPlan = excess > 0 ? calculateSmoothAdjustment(excess, 3) : null;
      onLogMeal(item, adjustmentPlan);
      setError(null);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to log this restaurant meal. Please try again.');
    }
  };

  return <Modal open={open} onClose={onClose} title="Eating Out"><div className="space-y-3">
    {error && <p role="alert" className="rounded-lg bg-accent-red/10 px-3 py-2 text-sm text-accent-red">{error}</p>}
    <p className="text-xs text-slate-400">Remaining calories today: <span className="font-semibold text-accent-green">{Math.round(remainingCalories)} kcal</span></p>
    <p className="text-xs text-slate-500">Representative menu nutrition is an estimate for planning, not a current restaurant menu or order confirmation. Verify your selected location&apos;s nutrition.</p>
    <select value={chainId} onChange={(event) => setChainId(event.target.value)} aria-label="Restaurant chain" className="input">{RESTAURANT_CHAINS.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select>
    <div className="space-y-2">{chain.items.map((item) => { const isBest = item.id === bestChoice.id; return <div key={item.id} className={`rounded-xl border p-3 ${isBest ? 'border-accent-green bg-accent-green/10' : 'border-surface-border bg-white/5'}`}><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-slate-100">{item.name}{isBest && <span className="ml-2 rounded-full bg-accent-green/20 px-2 py-0.5 text-[10px] font-semibold text-accent-green">Best Meal Choice</span>}</p><p className="mt-1 text-xs text-slate-400">{item.calories} kcal · P{item.proteinGrams}g · C{item.carbGrams}g · F{item.fatGrams}g</p>{item.calories > remainingCalories && <p className="mt-1 text-[11px] text-accent-amber">The overage is split across the next 3 calendar days, not today.</p>}</div><button onClick={() => handleLog(item)} className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent/90">Log This Meal</button></div></div>; })}</div>
  </div></Modal>;
}
