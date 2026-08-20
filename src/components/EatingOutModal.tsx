'use client';

import { useMemo, useState } from 'react';
import { RESTAURANT_CHAINS, findBestRestaurantChoice, type RestaurantMenuItem } from '@/lib/restaurantMenu';
import { calculateSmoothAdjustment } from '@/lib/fitnessMealPlanner';
import type { SmoothAdjustmentPlan } from '@/lib/fitnessMealPlanner';
import Modal from './ui/Modal';

interface EatingOutModalProps {
  open: boolean;
  onClose: () => void;
  remainingCalories: number;
  onLogMeal: (item: RestaurantMenuItem, adjustmentPlan: SmoothAdjustmentPlan | null) => void;
}

export default function EatingOutModal({ open, onClose, remainingCalories, onLogMeal }: EatingOutModalProps) {
  const [chainId, setChainId] = useState(RESTAURANT_CHAINS[0].id);
  const chain = RESTAURANT_CHAINS.find((c) => c.id === chainId) ?? RESTAURANT_CHAINS[0];

  const bestChoice = useMemo(
    () => findBestRestaurantChoice(chain.items, remainingCalories),
    [chain, remainingCalories],
  );

  const handleLog = (item: RestaurantMenuItem) => {
    const excess = item.calories - remainingCalories;
    const adjustmentPlan = excess > 0 ? calculateSmoothAdjustment(excess, 3) : null;
    onLogMeal(item, adjustmentPlan);
  };

  return (
    <Modal open={open} onClose={onClose} title="Eating Out">
      <div className="space-y-3">
        <p className="text-xs text-slate-400">
          Remaining calories today: <span className="font-semibold text-accent-green">{Math.round(remainingCalories)} kcal</span>
        </p>

        <select value={chainId} onChange={(e) => setChainId(e.target.value)} className="input">
          {RESTAURANT_CHAINS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <div className="space-y-2">
          {chain.items.map((item) => {
            const isBest = item.id === bestChoice.id;
            return (
              <div
                key={item.id}
                className={`rounded-xl border p-3 ${
                  isBest ? 'border-accent-green bg-accent-green/10' : 'border-surface-border bg-white/5'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">
                      {item.name}
                      {isBest && (
                        <span className="ml-2 rounded-full bg-accent-green/20 px-2 py-0.5 text-[10px] font-semibold text-accent-green">
                          Best Meal Choice
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {item.calories} kcal · P{item.proteinGrams}g · C{item.carbGrams}g · F{item.fatGrams}g
                    </p>
                  </div>
                  <button
                    onClick={() => handleLog(item)}
                    className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent/90"
                  >
                    Log This Meal
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
