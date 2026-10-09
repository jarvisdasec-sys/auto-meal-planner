'use client';

import { useEffect, useMemo, useState } from 'react';
import { compareDateKeys, isDateKey, localDateKey } from '@/lib/dateKeys';
import { downloadText, planFingerprint, scalePlanForHousehold, toCsv, validateHouseholdSize } from '@/lib/premiumPlanner';
import {
  estimatePlanGroceryCost,
  getGroceryRequirements,
  type GroceryRequirement,
} from '@/lib/pantryPlanner';
import { STORE_LABELS } from '@/lib/stores';
import { getActiveWeeklyPlan, useMealPlannerStore } from '@/store/useMealPlannerStore';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import Card from './ui/Card';

const AISLE_ORDER = ['Produce', 'Meat & Seafood', 'Dairy', 'Pantry & Grains', 'Snacks'] as const;
type Aisle = (typeof AISLE_ORDER)[number];

const AISLE_BY_CATEGORY: Record<GroceryRequirement['category'], Aisle> = {
  protein: 'Meat & Seafood',
  carb: 'Pantry & Grains',
  fat: 'Pantry & Grains',
  vegetable: 'Produce',
  snack: 'Snacks',
};

const AISLE_OVERRIDES: Record<string, Aisle> = {
  'egg-whites': 'Dairy',
  'greek-yogurt': 'Dairy',
};

/** Callbacks used by the dashboard shell to open the existing pantry and weekly planning tools. */
export interface ShoppingWorkspaceProps {
  /** Opens the existing Grocery Estimator, where pantry portions and expiry dates are managed. */
  onOpenPantry: () => void;
  /** Opens the weekly planning workspace when no active plan can supply a shopping list. */
  onOpenPlan: () => void;
}

function aisleFor(requirement: GroceryRequirement): Aisle {
  return AISLE_OVERRIDES[requirement.foodId] ?? AISLE_BY_CATEGORY[requirement.category];
}

function formatPortions(portions: number): string {
  const rounded = Math.round(portions * 100) / 100;
  return `${rounded} portion${rounded === 1 ? '' : 's'}`;
}

function money(value: number): string {
  return `$${value.toFixed(2)}`;
}

/**
 * A household-aware, plan-specific shopping list. It never changes personal nutrition logs;
 * purchased checkmarks are browser-local and do not add stock to the pantry.
 */
export default function ShoppingWorkspace({ onOpenPantry, onOpenPlan }: ShoppingWorkspaceProps) {
  const profile = useMealPlannerStore((state) => state.profile);
  const foodCatalog = useMealPlannerStore((state) => state.foodCatalog);
  const weeklyPlan = useMealPlannerStore((state) => state.weeklyPlan);
  const pantryStock = useMealPlannerStore((state) => state.pantryStock);

  const householdSize = useWorkspaceStore((state) => state.householdSize);
  const weeklyBudget = useWorkspaceStore((state) => state.weeklyBudget);
  const purchased = useWorkspaceStore((state) => state.purchased);
  const updatePreferences = useWorkspaceStore((state) => state.updatePreferences);
  const togglePurchased = useWorkspaceStore((state) => state.togglePurchased);

  const [householdDraft, setHouseholdDraft] = useState(String(householdSize));
  const [budgetDraft, setBudgetDraft] = useState(String(weeklyBudget));
  const [preferenceError, setPreferenceError] = useState<string | null>(null);
  const [preferenceStatus, setPreferenceStatus] = useState<string | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);

  useEffect(() => {
    setHouseholdDraft(String(householdSize));
    setBudgetDraft(String(weeklyBudget));
  }, [householdSize, weeklyBudget]);

  // Keep selectors scalar-only: resolving a plan returns a new array on each call.
  const activeWeeklyPlan = useMemo(
    () => getActiveWeeklyPlan({ weeklyPlan, foodCatalog, profile }),
    [weeklyPlan, foodCatalog, profile],
  );
  const scaledPlan = useMemo(
    () => scalePlanForHousehold(activeWeeklyPlan, householdSize),
    [activeWeeklyPlan, householdSize],
  );
  const requirements = useMemo(
    () => getGroceryRequirements(scaledPlan, pantryStock),
    [scaledPlan, pantryStock],
  );
  const purchaseRequirements = useMemo(
    () => requirements.filter((requirement) => requirement.toBuyPortions > 0),
    [requirements],
  );
  const planCost = useMemo(
    () => estimatePlanGroceryCost(requirements, foodCatalog, profile.preferredStore),
    [requirements, foodCatalog, profile.preferredStore],
  );
  const lineCosts = useMemo(() => new Map(
    purchaseRequirements.map((requirement) => [
      requirement.foodId,
      estimatePlanGroceryCost([requirement], foodCatalog, profile.preferredStore),
    ]),
  ), [purchaseRequirements, foodCatalog, profile.preferredStore]);

  const groupedRequirements = useMemo(() => {
    const groups = new Map<Aisle, GroceryRequirement[]>();
    for (const aisle of AISLE_ORDER) groups.set(aisle, []);
    for (const requirement of purchaseRequirements) groups.get(aisleFor(requirement))?.push(requirement);
    for (const group of groups.values()) group.sort((left, right) => left.name.localeCompare(right.name));
    return groups;
  }, [purchaseRequirements]);

  const checklistKey = useMemo(() => {
    const fingerprint = planFingerprint(weeklyPlan?.startDateKey, activeWeeklyPlan, householdSize);
    // Pantry changes can alter required quantities without altering the plan itself.
    const quantities = requirements
      .map((item) => `${item.foodId}:${item.plannedPortions}:${item.onHandPortions}:${item.toBuyPortions}`)
      .sort()
      .join('|');
    return `${fingerprint}:requirements:${quantities}`;
  }, [activeWeeklyPlan, householdSize, requirements, weeklyPlan?.startDateKey]);
  const purchasedSet = useMemo(() => new Set(purchased[checklistKey] ?? []), [purchased, checklistKey]);
  const purchasedCount = purchaseRequirements.filter((item) => purchasedSet.has(item.foodId)).length;

  const expiredPantryItems = useMemo(() => {
    const today = localDateKey();
    return Object.entries(pantryStock).filter(([, stock]) => (
      isDateKey(stock.expiresOn) && compareDateKeys(stock.expiresOn, today) < 0
    ));
  }, [pantryStock]);

  const pantryCoveredCount = requirements.filter((requirement) => requirement.toBuyPortions === 0).length;
  const budgetVariance = planCost.subtotal - weeklyBudget;

  const savePreferences = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPreferenceError(null);
    setPreferenceStatus(null);

    if (!householdDraft.trim() || !budgetDraft.trim()) {
      setPreferenceError('Enter a household size and weekly grocery budget.');
      return;
    }

    const nextHouseholdSize = Number(householdDraft);
    const nextBudget = Number(budgetDraft);
    try {
      validateHouseholdSize(nextHouseholdSize);
      if (!Number.isFinite(nextBudget) || nextBudget < 0 || nextBudget > 10000) {
        throw new Error('Weekly budget must be between $0 and $10,000.');
      }
      updatePreferences(nextHouseholdSize, nextBudget);
      setPreferenceStatus('Household shopping preferences saved in this browser.');
    } catch (error) {
      setPreferenceError(error instanceof Error ? error.message : 'Unable to save household preferences.');
    }
  };

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      ['Aisle', 'Food', 'Planned portions', 'Pantry portions', 'To buy portions', 'Portion label', 'Purchased', `Estimate at ${STORE_LABELS[profile.preferredStore]}`],
      ...purchaseRequirements.map((requirement) => {
        const estimate = lineCosts.get(requirement.foodId);
        return [
          aisleFor(requirement),
          requirement.name,
          requirement.plannedPortions,
          requirement.onHandPortions,
          requirement.toBuyPortions,
          requirement.portionLabel,
          purchasedSet.has(requirement.foodId) ? 'Yes' : 'No',
          estimate?.hasUnknownPrices ? 'Price unavailable' : money(estimate?.subtotal ?? 0),
        ];
      }),
    ];
    const date = weeklyPlan?.startDateKey ?? 'active-plan';
    downloadText(`btb-shopping-list-${date}.csv`, toCsv(rows));
  };

  const printList = () => {
    setPrintError(null);
    try {
      if (typeof window.print !== 'function') {
        setPrintError('Printing is unavailable in this browser. Use your browser print command to save this list.');
        return;
      }
      window.print();
    } catch {
      setPrintError('The print dialog could not open. Use your browser print command to save this list.');
    }
  };

  if (activeWeeklyPlan.length === 0) {
    return (
      <Card className="border-accent/30">
        <p className="btb-eyebrow text-accent">SHOPPING WORKSPACE</p>
        <h2 className="mt-2 text-2xl font-bold text-slate-100">Build a plan before you shop.</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Your active weekly plan supplies the quantities, pantry subtraction, and cost estimate for this workspace.
        </p>
        <div className="no-print mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={onOpenPlan} className="btb-button bg-accent px-4 py-2 text-sm font-semibold text-black">
            Open weekly plan
          </button>
          <button type="button" onClick={onOpenPantry} className="btb-secondary px-4 py-2 text-sm font-semibold text-slate-100">
            Review pantry inventory
          </button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="no-print">
        <p className="btb-eyebrow text-accent">HOUSEHOLD SETTINGS</p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-100">Scale the shopping list, not your nutrition log.</h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-400">
              Portions are multiplied for grocery and prep planning only. Your personal meal logging remains unchanged.
            </p>
          </div>
          <button type="button" onClick={onOpenPantry} className="btb-secondary px-3 py-2 text-sm font-semibold text-slate-100">
            Manage pantry
          </button>
        </div>
        <form className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,180px)_minmax(0,220px)_auto] sm:items-end" onSubmit={savePreferences} noValidate>
          <label className="text-sm font-medium text-slate-200" htmlFor="shopping-household-size">
            Household size
            <input
              id="shopping-household-size"
              type="number"
              min="1"
              max="12"
              step="1"
              inputMode="numeric"
              value={householdDraft}
              onChange={(event) => setHouseholdDraft(event.target.value)}
              aria-invalid={Boolean(preferenceError)}
              aria-describedby={preferenceError ? 'shopping-preferences-error' : undefined}
              className="input mt-1"
            />
          </label>
          <label className="text-sm font-medium text-slate-200" htmlFor="shopping-weekly-budget">
            Weekly grocery budget (USD)
            <input
              id="shopping-weekly-budget"
              type="number"
              min="0"
              max="10000"
              step="0.01"
              inputMode="decimal"
              value={budgetDraft}
              onChange={(event) => setBudgetDraft(event.target.value)}
              aria-invalid={Boolean(preferenceError)}
              aria-describedby={preferenceError ? 'shopping-preferences-error' : undefined}
              className="input mt-1"
            />
          </label>
          <button type="submit" className="btb-button bg-accent px-4 py-2.5 text-sm font-semibold text-black">
            Save preferences
          </button>
        </form>
        {preferenceError && <p id="shopping-preferences-error" role="alert" className="mt-3 text-sm text-accent-red">{preferenceError}</p>}
        {preferenceStatus && <p role="status" className="mt-3 text-sm text-accent-green">{preferenceStatus}</p>}
      </Card>

      <section className="print-area space-y-6" aria-label="Shopping list print area">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="btb-eyebrow text-accent">CURRENT PLAN · {householdSize} PERSON{householdSize === 1 ? '' : 'S'}</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-100">Shopping list by aisle</h2>
              <p className="mt-1 text-sm text-slate-400">
                Estimate at <span className="font-semibold text-slate-200">{STORE_LABELS[profile.preferredStore]}</span>. Quantities include pantry subtraction.
              </p>
            </div>
            <div className="rounded-xl border border-surface-border bg-black/20 px-4 py-3 text-right">
              <p className="text-xs uppercase tracking-wide text-slate-400">Purchased</p>
              <p className="mt-1 text-lg font-bold text-slate-100">{purchasedCount} / {purchaseRequirements.length}</p>
            </div>
          </div>

          {expiredPantryItems.length > 0 && (
            <p className="mt-4 rounded-xl border border-accent-amber/30 bg-accent-amber/10 px-3 py-2 text-sm text-accent-amber" role="status">
              {expiredPantryItems.length} pantry item{expiredPantryItems.length === 1 ? '' : 's'} {expiredPantryItems.length === 1 ? 'has' : 'have'} a recorded expired date. Expired portions are not available for this shopping list; review them in Pantry.
            </p>
          )}

          {pantryCoveredCount > 0 && (
            <p className="mt-3 text-sm text-slate-400">
              {pantryCoveredCount} item{pantryCoveredCount === 1 ? '' : 's'} {pantryCoveredCount === 1 ? 'is' : 'are'} fully covered by recorded pantry portions and omitted from the purchase checklist.
            </p>
          )}

          {purchaseRequirements.length === 0 ? (
            <div className="mt-5 rounded-xl border border-dashed border-surface-border bg-white/[0.03] p-5">
              <h3 className="font-semibold text-slate-100">Your recorded pantry covers this plan.</h3>
              <p className="mt-1 text-sm text-slate-400">Review expiry dates in Pantry before relying on on-hand portions.</p>
              <button type="button" onClick={onOpenPantry} className="no-print btb-secondary mt-3 px-3 py-2 text-sm font-semibold text-slate-100">
                Review pantry inventory
              </button>
            </div>
          ) : (
            <div className="mt-5 space-y-5">
              {AISLE_ORDER.map((aisle) => {
                const aisleRequirements = groupedRequirements.get(aisle) ?? [];
                if (aisleRequirements.length === 0) return null;
                return (
                  <section key={aisle} aria-labelledby={`shopping-aisle-${aisle.replace(/[^a-z]/gi, '-').toLowerCase()}`}>
                    <h3 id={`shopping-aisle-${aisle.replace(/[^a-z]/gi, '-').toLowerCase()}`} className="btb-eyebrow border-b border-surface-border pb-2 text-accent">
                      {aisle}
                    </h3>
                    <ul className="mt-3 space-y-2">
                      {aisleRequirements.map((requirement) => {
                        const isPurchased = purchasedSet.has(requirement.foodId);
                        const estimate = lineCosts.get(requirement.foodId);
                        return (
                          <li key={requirement.foodId} className="rounded-xl border border-surface-border bg-black/15 p-3">
                            <div className="flex items-start gap-3">
                              <input
                                id={`shopping-purchased-${requirement.foodId}`}
                                type="checkbox"
                                checked={isPurchased}
                                onChange={() => togglePurchased(checklistKey, requirement.foodId)}
                                className="no-print mt-1 h-4 w-4 accent-accent"
                              />
                              <div className="min-w-0 flex-1">
                                <label htmlFor={`shopping-purchased-${requirement.foodId}`} className={`cursor-pointer font-semibold ${isPurchased ? 'text-slate-500 line-through' : 'text-slate-100'}`}>
                                  {requirement.name}
                                </label>
                                <p className="mt-1 text-xs text-slate-400">
                                  Planned {formatPortions(requirement.plannedPortions)} · Pantry {formatPortions(requirement.onHandPortions)} · Buy {formatPortions(requirement.toBuyPortions)}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">Portion: {requirement.portionLabel}</p>
                              </div>
                              <span className="shrink-0 text-right text-xs font-medium text-slate-300">
                                {estimate?.hasUnknownPrices ? 'Price unavailable' : money(estimate?.subtotal ?? 0)}
                              </span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </Card>

        <Card>
          <p className="btb-eyebrow text-accent">BUDGET CHECK</p>
          <div className="mt-2 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-sm text-slate-400">Weekly budget</p>
              <p className="mt-1 text-xl font-bold text-slate-100">{money(weeklyBudget)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-400">{planCost.hasUnknownPrices ? 'Known subtotal (partial)' : 'Estimated subtotal'}</p>
              <p className="mt-1 text-xl font-bold text-slate-100">{money(planCost.subtotal)}</p>
            </div>
            <div>
              <p className="text-sm text-slate-400">Budget variance</p>
              {planCost.hasUnknownPrices ? (
                <p className="mt-1 text-sm font-semibold text-accent-amber">Unavailable while prices are missing</p>
              ) : budgetVariance > 0 ? (
                <p className="mt-1 text-xl font-bold text-accent-red">{money(budgetVariance)} over</p>
              ) : budgetVariance < 0 ? (
                <p className="mt-1 text-xl font-bold text-accent-green">{money(Math.abs(budgetVariance))} under</p>
              ) : (
                <p className="mt-1 text-xl font-bold text-slate-100">On budget</p>
              )}
            </div>
          </div>
          {planCost.hasUnknownPrices ? (
            <p className="mt-4 rounded-xl border border-accent-amber/30 bg-accent-amber/10 px-3 py-2 text-sm text-accent-amber" role="status">
              {planCost.unknownPriceFoodIds.length} item{planCost.unknownPriceFoodIds.length === 1 ? '' : 's'} {planCost.unknownPriceFoodIds.length === 1 ? 'has' : 'have'} no usable {STORE_LABELS[profile.preferredStore]} price. The subtotal excludes those items, so this workspace cannot confirm that the plan is under budget.
            </p>
          ) : (
            <p className="mt-4 text-sm text-slate-400">Price estimates are per portion, not live store prices. Confirm package sizes and current prices before purchase.</p>
          )}
        </Card>
      </section>

      <div className="no-print flex flex-wrap gap-3">
        <button type="button" onClick={exportCsv} disabled={purchaseRequirements.length === 0} className="btb-button bg-accent px-4 py-2.5 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50">
          Download CSV
        </button>
        <button type="button" onClick={printList} className="btb-secondary px-4 py-2.5 text-sm font-semibold text-slate-100">
          Print list
        </button>
        <button type="button" onClick={onOpenPantry} className="btb-secondary px-4 py-2.5 text-sm font-semibold text-slate-100">
          Open pantry
        </button>
      </div>
      {printError && <p className="no-print text-sm text-accent-red" role="alert">{printError}</p>}
      <p className="no-print text-xs text-slate-500">Purchase checkmarks are local to this plan and quantity set. They do not change pantry inventory.</p>
    </div>
  );
}
