'use client';

import { useMemo, useState } from 'react';
import { useMealPlannerStore } from '@/store/useMealPlannerStore';
import { estimateGroceryCost, estimateGroceryCostByAllStores } from '@/lib/fitnessMealPlanner';
import type { StoreName } from '@/lib/fitnessMealPlanner';
import { STORE_LABELS } from '@/lib/stores';
import {
  buildMealWindowGroups,
  generateWeeklyMealPlan,
  computePantryInventory,
  generateUseWhatIHaveSuggestion,
  getDayName,
} from '@/lib/pantryPlanner';
import Card from './ui/Card';
import GroceryListModal from './GroceryListModal';

export default function GroceryEstimator() {
  const profile = useMealPlannerStore((s) => s.profile);
  const foodCatalog = useMealPlannerStore((s) => s.foodCatalog);
  const [groceryListOpen, setGroceryListOpen] = useState(false);
  const [showUseWhatIHave, setShowUseWhatIHave] = useState(false);

  const weeklyPlan = useMemo(
    () => generateWeeklyMealPlan(buildMealWindowGroups(foodCatalog, profile)),
    [foodCatalog, profile],
  );
  const pantryEntries = useMemo(() => computePantryInventory(weeklyPlan), [weeklyPlan]);
  const expiringEntries = useMemo(
    () => pantryEntries.filter((entry) => entry.status === 'in_pantry_expiring'),
    [pantryEntries],
  );
  const useWhatIHaveSuggestion = useMemo(() => generateUseWhatIHaveSuggestion(pantryEntries), [pantryEntries]);

  const preferredEstimate = useMemo(
    () => estimateGroceryCost(foodCatalog, profile.preferredStore),
    [foodCatalog, profile.preferredStore],
  );

  const allStoreEstimates = useMemo(() => estimateGroceryCostByAllStores(foodCatalog), [foodCatalog]);

  const cheapestStore = useMemo(() => {
    const stores = Object.values(allStoreEstimates);
    return stores.reduce((min, curr) => (curr.dailyCost < min.dailyCost ? curr : min), stores[0]);
  }, [allStoreEstimates]);

  return (
    <div className="space-y-6">
      <Card
        title="Pantry & Food-Waste"
        subtitle="Ingredients carried over across the week, prioritized before new grocery items"
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {expiringEntries.length > 0 ? (
              <span className="rounded-full bg-accent-amber/15 px-3 py-1 text-xs font-semibold text-accent-amber">
                ⚠️ {expiringEntries.length} item{expiringEntries.length > 1 ? 's' : ''} Expiring Soon
              </span>
            ) : (
              <span className="rounded-full bg-accent-green/15 px-3 py-1 text-xs font-semibold text-accent-green">
                No expiring items this week
              </span>
            )}
          </div>
          <button
            onClick={() => setShowUseWhatIHave((prev) => !prev)}
            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent/90"
          >
            Use What I Have
          </button>
        </div>

        {showUseWhatIHave && (
          <div className="mb-3 rounded-xl bg-white/5 p-3 text-sm text-slate-300">
            {useWhatIHaveSuggestion ? (
              <>
                <p className="font-semibold text-accent-green">{useWhatIHaveSuggestion.title}</p>
                <p className="mt-1 text-xs text-slate-400">{useWhatIHaveSuggestion.note}</p>
              </>
            ) : (
              <p className="text-xs text-slate-400">Nothing expiring right now — your pantry is in good shape.</p>
            )}
          </div>
        )}

        <div className="space-y-2">
          {pantryEntries
            .filter((entry) => entry.status !== 'to_buy')
            .map((entry) => (
              <div key={entry.foodId} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm">
                <span className="text-slate-200">{entry.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">
                    Used {getDayName(entry.daysUsed[0])}
                    {entry.daysUsed.length > 1 ? ` \u2192 ${getDayName(entry.daysUsed[entry.daysUsed.length - 1])}` : ''}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      entry.status === 'in_pantry_expiring'
                        ? 'bg-accent-amber/15 text-accent-amber'
                        : 'bg-white/10 text-slate-300'
                    }`}
                  >
                    {entry.status === 'in_pantry_expiring' ? 'In Pantry / Expiring Soon' : 'In Pantry'}
                  </span>
                </div>
              </div>
            ))}
          {pantryEntries.filter((entry) => entry.status !== 'to_buy').length === 0 && (
            <p className="text-sm text-slate-500">No carry-over pantry items detected this week.</p>
          )}
        </div>
      </Card>

      <Card
        title={`${STORE_LABELS[profile.preferredStore]} — Your Preferred Store`}
        subtitle="Based on your current food catalog selections"
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-white/5 p-4 text-center">
            <div className="text-2xl font-bold text-accent-green">${preferredEstimate.dailyCost.toFixed(2)}</div>
            <div className="mt-1 text-xs text-slate-400">Estimated Daily Cost</div>
          </div>
          <div className="rounded-xl bg-white/5 p-4 text-center">
            <div className="text-2xl font-bold text-accent">${preferredEstimate.weeklyCost.toFixed(2)}</div>
            <div className="mt-1 text-xs text-slate-400">Estimated Weekly Cost</div>
          </div>
        </div>
        <button
          onClick={() => setGroceryListOpen(true)}
          className="mt-4 w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent/90"
        >
          Generate Grocery List
        </button>
      </Card>

      <GroceryListModal
        open={groceryListOpen}
        onClose={() => setGroceryListOpen(false)}
        foodCatalog={foodCatalog}
        snackCravings={profile.snackCravings}
        preferredStore={profile.preferredStore}
      />

      <Card title="Store Comparison" subtitle="Side-by-side estimated costs across supported stores">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-surface-border text-left text-slate-400">
                <th className="py-2 pr-4 font-medium">Store</th>
                <th className="py-2 pr-4 font-medium">Daily Cost</th>
                <th className="py-2 pr-4 font-medium">Weekly Cost</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(allStoreEstimates) as StoreName[]).map((store) => {
                const estimate = allStoreEstimates[store];
                const isCheapest = estimate.store === cheapestStore.store;
                const isPreferred = store === profile.preferredStore;
                return (
                  <tr key={store} className="border-b border-surface-border/60 last:border-0">
                    <td className="py-3 pr-4 font-medium text-slate-100">
                      {STORE_LABELS[store]}
                      {isPreferred && (
                        <span className="ml-2 rounded-full bg-accent/20 px-2 py-0.5 text-xs text-accent">
                          Preferred
                        </span>
                      )}
                      {isCheapest && (
                        <span className="ml-2 rounded-full bg-accent-green/20 px-2 py-0.5 text-xs text-accent-green">
                          Cheapest
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-slate-300">${estimate.dailyCost.toFixed(2)}</td>
                    <td className="py-3 pr-4 text-slate-300">${estimate.weeklyCost.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
