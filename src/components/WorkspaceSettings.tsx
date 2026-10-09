'use client';

import { useEffect, useState } from 'react';
import { entryDateKey } from '@/lib/dateKeys';
import { loadMyFoods } from '@/lib/myFoodsStorage';
import { downloadText, toCsv, validateHouseholdSize } from '@/lib/premiumPlanner';
import { useMealPlannerStore } from '@/store/useMealPlannerStore';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import Card from './ui/Card';

// This is the only auxiliary localStorage data used by the application. It contains user-created foods, not credentials.
const MY_FOODS_STORAGE_KEY = 'btb-meal-planner:my-foods';

/** Optional presentation hook for embedding Workspace Settings in a dashboard layout. */
export interface WorkspaceSettingsProps {
  /** Additional layout classes applied to the component root. */
  className?: string;
}

function csvNumber(value: number | undefined): number | '' {
  return typeof value === 'number' && Number.isFinite(value) ? value : '';
}

/**
 * Browser-local preferences and exports. This view intentionally provides no import or reset action,
 * so opening it cannot overwrite or delete a user's existing planning data.
 */
export default function WorkspaceSettings({ className = '' }: WorkspaceSettingsProps) {
  const profile = useMealPlannerStore((state) => state.profile);
  const foodCatalog = useMealPlannerStore((state) => state.foodCatalog);
  const exerciseLogs = useMealPlannerStore((state) => state.exerciseLogs);
  const loggedFoods = useMealPlannerStore((state) => state.loggedFoods);
  const hydrationLogs = useMealPlannerStore((state) => state.hydrationLogs);
  const savedRecipes = useMealPlannerStore((state) => state.savedRecipes);
  const weeklyPlan = useMealPlannerStore((state) => state.weeklyPlan);
  const pantryStock = useMealPlannerStore((state) => state.pantryStock);
  const calorieAdjustmentPlan = useMealPlannerStore((state) => state.calorieAdjustmentPlan);

  const householdSize = useWorkspaceStore((state) => state.householdSize);
  const weeklyBudget = useWorkspaceStore((state) => state.weeklyBudget);
  const prepSessions = useWorkspaceStore((state) => state.prepSessions);
  const purchased = useWorkspaceStore((state) => state.purchased);
  const storageAvailable = useWorkspaceStore((state) => state.storageAvailable);
  const updatePreferences = useWorkspaceStore((state) => state.updatePreferences);

  const [householdDraft, setHouseholdDraft] = useState(String(householdSize));
  const [budgetDraft, setBudgetDraft] = useState(String(weeklyBudget));
  const [preferenceError, setPreferenceError] = useState<string | null>(null);
  const [preferenceStatus, setPreferenceStatus] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    setHouseholdDraft(String(householdSize));
    setBudgetDraft(String(weeklyBudget));
  }, [householdSize, weeklyBudget]);

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
      setPreferenceStatus('Household preferences saved locally in this browser.');
    } catch (error) {
      setPreferenceError(error instanceof Error ? error.message : 'Unable to save household preferences.');
    }
  };

  const exportBrowserBackup = () => {
    setExportStatus(null);
    setExportError(null);
    try {
      // Explicit whitelist: this is persisted data only, never Zustand actions/functions or unrelated browser storage.
      const backup = {
        format: 'btb-meal-planner-browser-backup',
        version: 1,
        exportedAt: new Date().toISOString(),
        primaryStore: {
          profile,
          foodCatalog,
          exerciseLogs,
          loggedFoods,
          hydrationLogs,
          savedRecipes,
          weeklyPlan,
          pantryStock,
          calorieAdjustmentPlan,
        },
        workspace: {
          householdSize,
          weeklyBudget,
          prepSessions,
          purchased,
        },
        auxiliaryLocalStorage: {
          [MY_FOODS_STORAGE_KEY]: loadMyFoods(),
        },
      };
      downloadText(
        `btb-meal-planner-backup-${new Date().toISOString().slice(0, 10)}.json`,
        JSON.stringify(backup, null, 2),
        'application/json;charset=utf-8',
      );
      setExportStatus('Browser-local backup download started. Keep the file in a secure place.');
    } catch {
      setExportError('The backup could not be prepared in this browser. Your current in-browser data was not changed.');
    }
  };

  const exportFoodHistory = () => {
    setExportStatus(null);
    setExportError(null);
    try {
      const rows: (string | number | undefined)[][] = [
        ['Date', 'Timestamp', 'Meal', 'Food', 'Servings', 'Portion', 'Calories', 'Protein g', 'Carbs g', 'Fat g', 'Source'],
        ...loggedFoods
          .slice()
          .sort((left, right) => left.timestamp.localeCompare(right.timestamp))
          .map((entry) => [
            entryDateKey(entry),
            entry.timestamp,
            entry.mealType?.replace(/_/g, ' '),
            entry.name,
            entry.servings ?? 1,
            entry.portion,
            entry.calories,
            csvNumber(entry.proteinGrams),
            csvNumber(entry.carbGrams),
            csvNumber(entry.fatGrams),
            entry.source,
          ]),
      ];
      downloadText(`btb-food-history-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows));
      setExportStatus('Food history CSV download started.');
    } catch {
      setExportError('The food history CSV could not be prepared. Your existing logs were not changed.');
    }
  };

  return (
    <div className={`space-y-6 ${className}`.trim()}>
      <Card>
        <p className="btb-eyebrow text-accent">WORKSPACE PREFERENCES</p>
        <h2 className="mt-2 text-xl font-bold text-slate-100">Household &amp; weekly budget</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          These preferences scale shopping and meal-prep quantities only. They do not multiply your personal nutrition log.
        </p>
        <form className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,180px)_minmax(0,220px)_auto] sm:items-end" onSubmit={savePreferences} noValidate>
          <label className="text-sm font-medium text-slate-200" htmlFor="workspace-household-size">
            Household size
            <input
              id="workspace-household-size"
              type="number"
              min="1"
              max="12"
              step="1"
              inputMode="numeric"
              value={householdDraft}
              onChange={(event) => setHouseholdDraft(event.target.value)}
              aria-invalid={Boolean(preferenceError)}
              aria-describedby={preferenceError ? 'workspace-preferences-error' : undefined}
              className="input mt-1"
            />
          </label>
          <label className="text-sm font-medium text-slate-200" htmlFor="workspace-weekly-budget">
            Weekly grocery budget (USD)
            <input
              id="workspace-weekly-budget"
              type="number"
              min="0"
              max="10000"
              step="0.01"
              inputMode="decimal"
              value={budgetDraft}
              onChange={(event) => setBudgetDraft(event.target.value)}
              aria-invalid={Boolean(preferenceError)}
              aria-describedby={preferenceError ? 'workspace-preferences-error' : undefined}
              className="input mt-1"
            />
          </label>
          <button type="submit" className="btb-button bg-accent px-4 py-2.5 text-sm font-semibold text-black">
            Save preferences
          </button>
        </form>
        {preferenceError && <p id="workspace-preferences-error" role="alert" className="mt-3 text-sm text-accent-red">{preferenceError}</p>}
        {preferenceStatus && <p role="status" className="mt-3 text-sm text-accent-green">{preferenceStatus}</p>}
      </Card>

      <Card>
        <p className="btb-eyebrow text-accent">BACKUP &amp; EXPORT</p>
        <h2 className="mt-2 text-xl font-bold text-slate-100">Your data stays in this browser.</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-400">
          BTB Meal Planner has no account or cloud sync. A backup downloads the serializable planning data stored in this browser, household workspace preferences and checklists, plus saved My Foods. It does not include credentials, tokens, or unrelated browser storage.
        </p>
        {!storageAvailable && (
          <p className="mt-4 rounded-xl border border-accent-amber/30 bg-accent-amber/10 px-3 py-2 text-sm text-accent-amber" role="status">
            Browser storage is currently unavailable. You can still download the data available in this session, but new workspace preferences may not persist after closing the browser.
          </p>
        )}
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={exportBrowserBackup} className="btb-button bg-accent px-4 py-2.5 text-sm font-semibold text-black">
            Download browser backup (JSON)
          </button>
          <button type="button" onClick={exportFoodHistory} disabled={loggedFoods.length === 0} className="btb-secondary px-4 py-2.5 text-sm font-semibold text-slate-100 disabled:cursor-not-allowed disabled:opacity-50">
            Download food history (CSV)
          </button>
        </div>
        {loggedFoods.length === 0 && <p className="mt-3 text-xs text-slate-500">Log food first to enable a food history CSV.</p>}
        {exportStatus && <p role="status" className="mt-4 text-sm text-accent-green">{exportStatus}</p>}
        {exportError && <p role="alert" className="mt-4 text-sm text-accent-red">{exportError}</p>}
        <p className="mt-4 text-xs text-slate-500">This workspace intentionally has no import or reset control. Downloaded files are not uploaded anywhere by this app.</p>
      </Card>
    </div>
  );
}
