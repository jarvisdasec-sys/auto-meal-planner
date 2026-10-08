'use client';

import { useMemo, useState } from 'react';
import { getActiveWeeklyPlan, useMealPlannerStore } from '@/store/useMealPlannerStore';
import type { StoreName } from '@/lib/fitnessMealPlanner';
import { STORE_LABELS, STORE_NAMES } from '@/lib/stores';
import {
  computePantryInventory,
  estimatePlanGroceryCost,
  generateUseWhatIHaveSuggestion,
  getGroceryRequirements,
  type GroceryRequirement,
} from '@/lib/pantryPlanner';
import type { DateKey } from '@/lib/dateKeys';
import Card from './ui/Card';
import GroceryListModal from './GroceryListModal';

type PantryDraft = { portions: string; expiresOn: string };

function formatPortions(portions: number): string {
  const rounded = Math.round(portions * 100) / 100;
  return `${rounded} portion${rounded === 1 ? '' : 's'}`;
}

function pantryDraftFor(stock: { portions: number; expiresOn?: DateKey } | undefined): PantryDraft {
  return {
    portions: stock ? String(stock.portions) : '',
    expiresOn: stock?.expiresOn ?? '',
  };
}

function costStatusText(unknownCount: number): string {
  return `${unknownCount} item${unknownCount === 1 ? '' : 's'} price unavailable`;
}

export default function GroceryEstimator() {
  const profile = useMealPlannerStore((state) => state.profile);
  const foodCatalog = useMealPlannerStore((state) => state.foodCatalog);
  const weeklyPlan = useMealPlannerStore((state) => state.weeklyPlan);
  const pantryStock = useMealPlannerStore((state) => state.pantryStock);
  const setPantryStock = useMealPlannerStore((state) => state.setPantryStock);
  const clearPantryStock = useMealPlannerStore((state) => state.clearPantryStock);
  const setPreferredStore = useMealPlannerStore((state) => state.setPreferredStore);
  const [groceryListOpen, setGroceryListOpen] = useState(false);
  const [showUseWhatIHave, setShowUseWhatIHave] = useState(false);
  const [pantryDrafts, setPantryDrafts] = useState<Record<string, PantryDraft>>({});
  const [pantryErrors, setPantryErrors] = useState<Record<string, string>>({});

  // Keep the selector scalar-only: getActiveWeeklyPlan returns a new resolved array.
  const activeWeeklyPlan = useMemo(
    () => getActiveWeeklyPlan({ weeklyPlan, foodCatalog, profile }),
    [weeklyPlan, foodCatalog, profile],
  );
  const requirements = useMemo(
    () => getGroceryRequirements(activeWeeklyPlan, pantryStock),
    [activeWeeklyPlan, pantryStock],
  );
  const pantryEntries = useMemo(
    () => computePantryInventory(activeWeeklyPlan, pantryStock),
    [activeWeeklyPlan, pantryStock],
  );
  const expiringEntries = useMemo(
    () => pantryEntries.filter((entry) => entry.status === 'in_pantry_expiring'),
    [pantryEntries],
  );
  const useWhatIHaveSuggestion = useMemo(
    () => generateUseWhatIHaveSuggestion(pantryEntries),
    [pantryEntries],
  );

  const preferredEstimate = useMemo(
    () => estimatePlanGroceryCost(requirements, foodCatalog, profile.preferredStore),
    [requirements, foodCatalog, profile.preferredStore],
  );
  const allStoreEstimates = useMemo(
    () => Object.fromEntries(
      STORE_NAMES.map((store) => [store, estimatePlanGroceryCost(requirements, foodCatalog, store)]),
    ) as Record<StoreName, ReturnType<typeof estimatePlanGroceryCost>>, [requirements, foodCatalog]);
  const cheapestCompleteStore = useMemo(() => {
    if (requirements.length === 0) return undefined;
    const completeEstimates = STORE_NAMES
      .map((store) => allStoreEstimates[store])
      .filter((estimate) => !estimate.hasUnknownPrices);
    return completeEstimates.reduce<typeof completeEstimates[number] | undefined>(
      (lowest, estimate) => (!lowest || estimate.subtotal < lowest.subtotal ? estimate : lowest),
      undefined,
    )?.store;
  }, [allStoreEstimates, requirements.length]);

  const updatePantryDraft = (foodId: string, changes: Partial<PantryDraft>) => {
    setPantryDrafts((current) => ({
      ...current,
      [foodId]: { ...pantryDraftFor(pantryStock[foodId]), ...current[foodId], ...changes },
    }));
    setPantryErrors((current) => {
      const { [foodId]: _cleared, ...remaining } = current;
      return remaining;
    });
  };

  const savePantryStock = (requirement: GroceryRequirement) => {
    const draft = pantryDrafts[requirement.foodId] ?? pantryDraftFor(pantryStock[requirement.foodId]);
    if (draft.portions.trim() === '') {
      setPantryErrors((current) => ({
        ...current,
        [requirement.foodId]: 'Enter portions on hand (use 0 when none are on hand), then save.',
      }));
      return;
    }
    const portions = Number(draft.portions);
    if (!Number.isFinite(portions) || portions < 0) {
      setPantryErrors((current) => ({
        ...current,
        [requirement.foodId]: 'Portions on hand must be a zero or positive number.',
      }));
      return;
    }

    try {
      setPantryStock(requirement.foodId, {
        portions,
        ...(draft.expiresOn ? { expiresOn: draft.expiresOn as DateKey } : {}),
      });
      setPantryDrafts((current) => ({
        ...current,
        [requirement.foodId]: { portions: String(portions), expiresOn: draft.expiresOn },
      }));
      setPantryErrors((current) => {
        const { [requirement.foodId]: _cleared, ...remaining } = current;
        return remaining;
      });
    } catch (error) {
      setPantryErrors((current) => ({
        ...current,
        [requirement.foodId]: error instanceof Error ? error.message : 'Unable to save pantry stock. Check the portions and expiry date.',
      }));
    }
  };

  const removePantryStock = (foodId: string) => {
    clearPantryStock(foodId);
    setPantryDrafts((current) => {
      const { [foodId]: _removed, ...remaining } = current;
      return remaining;
    });
    setPantryErrors((current) => {
      const { [foodId]: _removed, ...remaining } = current;
      return remaining;
    });
  };

  return (
    <div className="space-y-6">
      <Card
        title="Pantry & Food-Waste"
        subtitle="Record actual portions on hand; repeated plan use is not treated as inventory."
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {expiringEntries.length > 0 ? (
              <span className="rounded-full bg-accent-amber/15 px-3 py-1 text-xs font-semibold text-accent-amber">
                {expiringEntries.length} item{expiringEntries.length > 1 ? 's' : ''} expiring soon
              </span>
            ) : (
              <span className="rounded-full bg-accent-green/15 px-3 py-1 text-xs font-semibold text-accent-green">
                No recorded pantry items expiring soon
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowUseWhatIHave((previous) => !previous)}
            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent/90"
            aria-expanded={showUseWhatIHave}
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
              <p className="text-xs text-slate-400">No recorded expiring pantry stock is available to prioritize yet.</p>
            )}
          </div>
        )}

        {requirements.length === 0 ? (
          <p className="rounded-lg bg-white/5 p-3 text-sm text-slate-400">
            Generate a weekly plan in Daily Meal Plan before recording pantry stock or estimating groceries.
          </p>
        ) : (
          <div className="space-y-3">
            {requirements.map((requirement) => {
              const draft = pantryDrafts[requirement.foodId] ?? pantryDraftFor(pantryStock[requirement.foodId]);
              const error = pantryErrors[requirement.foodId];
              const portionsInputId = `pantry-portions-${requirement.foodId}`;
              const expiryInputId = `pantry-expiry-${requirement.foodId}`;
              return (
                <div key={requirement.foodId} className="rounded-xl bg-white/5 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-100">{requirement.name}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        Planned: {formatPortions(requirement.plannedPortions)} · On hand: {formatPortions(requirement.onHandPortions)} · To buy: {formatPortions(requirement.toBuyPortions)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">Portion: {requirement.portionLabel}</p>
                    </div>
                    {requirement.expiresOn && (
                      <span className="rounded-full bg-accent-amber/15 px-2 py-0.5 text-xs font-medium text-accent-amber">
                        Expires {requirement.expiresOn}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] sm:items-end">
                    <label className="text-xs font-medium text-slate-300" htmlFor={portionsInputId}>
                      Portions on hand
                      <input
                        id={portionsInputId}
                        type="number"
                        min="0"
                        step="0.25"
                        inputMode="decimal"
                        value={draft.portions}
                        onChange={(event) => updatePantryDraft(requirement.foodId, { portions: event.target.value })}
                        className="input mt-1"
                        aria-describedby={error ? `${portionsInputId}-error` : undefined}
                      />
                    </label>
                    <label className="text-xs font-medium text-slate-300" htmlFor={expiryInputId}>
                      Expiry (optional)
                      <input
                        id={expiryInputId}
                        type="date"
                        value={draft.expiresOn}
                        onChange={(event) => updatePantryDraft(requirement.foodId, { expiresOn: event.target.value })}
                        className="input mt-1"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => savePantryStock(requirement)}
                      className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-accent/90"
                    >
                      Save stock
                    </button>
                    {pantryStock[requirement.foodId] && (
                      <button
                        type="button"
                        onClick={() => removePantryStock(requirement.foodId)}
                        className="rounded-lg bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/10"
                      >
                        Remove stock
                      </button>
                    )}
                  </div>
                  {error && <p id={`${portionsInputId}-error`} role="alert" className="mt-2 text-xs text-accent-amber">{error}</p>}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card
        title={`${STORE_LABELS[profile.preferredStore]} — Your Preferred Store`}
        subtitle="Static per-portion estimates for the active plan, not live store prices."
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <label className="text-xs font-medium text-slate-300" htmlFor="grocery-store">
            Estimate at store
            <select
              id="grocery-store"
              value={profile.preferredStore}
              onChange={(event) => setPreferredStore(event.target.value as StoreName)}
              className="input mt-1 min-w-48"
            >
              {STORE_NAMES.map((store) => <option key={store} value={store}>{STORE_LABELS[store]}</option>)}
            </select>
          </label>
          {requirements.length > 0 && (
            <div className="text-right">
              <div className="text-2xl font-bold text-accent">
                ${preferredEstimate.subtotal.toFixed(2)}
              </div>
              <div className="mt-1 text-xs text-slate-400">
                {preferredEstimate.hasUnknownPrices ? 'Known estimated subtotal (partial)' : 'Estimated plan subtotal'}
              </div>
            </div>
          )}
        </div>
        {requirements.length === 0 ? (
          <p className="mt-4 rounded-lg bg-white/5 p-3 text-sm text-slate-400">
            No active weekly plan is available. Generate one before viewing a grocery estimate.
          </p>
        ) : preferredEstimate.hasUnknownPrices ? (
          <p className="mt-4 rounded-lg bg-accent-amber/10 p-3 text-sm text-accent-amber" role="status">
            {costStatusText(preferredEstimate.unknownPriceFoodIds.length)}. Add a per-portion estimate to those food records to include them; they are not counted as free.
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => setGroceryListOpen(true)}
          disabled={requirements.length === 0}
          className="mt-4 w-full rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
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
        requirements={requirements}
      />

      <Card title="Store Comparison" subtitle="Static plan estimates; partial subtotals exclude unavailable prices.">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-surface-border text-left text-slate-400">
                <th className="py-2 pr-4 font-medium">Store</th>
                <th className="py-2 pr-4 font-medium">Known subtotal</th>
                <th className="py-2 font-medium">Price status</th>
              </tr>
            </thead>
            <tbody>
              {STORE_NAMES.map((store) => {
                const estimate = allStoreEstimates[store];
                const isPreferred = store === profile.preferredStore;
                const isCheapest = store === cheapestCompleteStore;
                return (
                  <tr key={store} className="border-b border-surface-border/60 last:border-0">
                    <td className="py-3 pr-4 font-medium text-slate-100">
                      {STORE_LABELS[store]}
                      {isPreferred && <span className="ml-2 rounded-full bg-accent/20 px-2 py-0.5 text-xs text-accent">Preferred</span>}
                      {isCheapest && <span className="ml-2 rounded-full bg-accent-green/20 px-2 py-0.5 text-xs text-accent-green">Lowest complete estimate</span>}
                    </td>
                    <td className="py-3 pr-4 text-slate-300">${estimate.subtotal.toFixed(2)}</td>
                    <td className="py-3 text-slate-300">
                      {requirements.length === 0
                        ? 'No active plan'
                        : estimate.hasUnknownPrices
                          ? `${costStatusText(estimate.unknownPriceFoodIds.length)} — partial`
                          : 'All plan prices available'}
                    </td>
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
