'use client';

import { useEffect, useState } from 'react';
import { hydrateMealPlannerStore } from '@/store/useMealPlannerStore';
import { hydrateWorkspaceStore, useWorkspaceStore } from '@/store/useWorkspaceStore';
import { hydrateRecipeWeekStore, useRecipeWeekStore } from '@/store/useRecipeWeekStore';
import PlannerOverview from './PlannerOverview';
import WeeklyPlanner from './WeeklyPlanner';
import RecipeWeekPlanner from './RecipeWeekPlanner';
import MealPrepHub from './MealPrepHub';
import ShoppingWorkspace from './ShoppingWorkspace';
import WorkspaceSettings from './WorkspaceSettings';
import RecipeBuilder from './RecipeBuilder';
import ProfileSetupForm from './ProfileSetupForm';
import MealPlanView from './MealPlanView';
import EnergyTracker from './EnergyTracker';
import GroceryEstimator from './GroceryEstimator';
import PortionGallery from './PortionGallery';
import HistoryTracker from './HistoryTracker';
import RecipeBox from './RecipeBox';
import FoodLogger from './FoodLogger';

const TABS = [
  { id: 'overview', label: 'Overview', title: 'Plan the week. Prep with purpose.', detail: 'Your meals, your progress, your next move—all in one BTB workspace.' },
  { id: 'recipeWeek', label: 'Recipe Week', title: 'Cook from a complete plan.', detail: 'Measured ingredients, real instructions, and practical kitchen workflow.' },
  { id: 'week', label: 'Food Week', title: 'Your food-based seven-day blueprint.', detail: 'Build, personalize, and keep the individual-food plan in focus.' },
  { id: 'prep', label: 'Meal Prep', title: 'Own your kitchen routine.', detail: 'Batch prep, portion, label, and store with intention.' },
  { id: 'shopping', label: 'Shopping List', title: 'Shop only what your plan needs.', detail: 'Household quantities, pantry awareness, and budget clarity.' },
  { id: 'meals', label: 'Daily Meal Plan', title: 'Dial in the details.', detail: 'Cooking methods, portions, replacements, and logging.' },
  { id: 'foodLogger', label: 'Food Logger', title: 'Log what you actually eat.', detail: 'Search, scan, or enter nutrition from a real label.' },
  { id: 'tracker', label: 'Nutrition & Hydration', title: 'Keep progress in perspective.', detail: 'Actual intake, energy balance, and daily hydration.' },
  { id: 'recipes', label: 'Recipe Library', title: 'Make your go-to meals repeatable.', detail: 'Create a recipe, save it, and use it in your plan.' },
  { id: 'grocery', label: 'Pantry & Store Costs', title: 'Use what you have.', detail: 'Record pantry stock and compare estimated store costs.' },
  { id: 'history', label: 'History', title: 'See the pattern, not just the day.', detail: 'Review and adjust your dated nutrition records.' },
  { id: 'portion', label: 'Portion Guide', title: 'Build portion awareness.', detail: 'Practical reference guides—not a replacement for measured labels.' },
  { id: 'profile', label: 'Profile & Goals', title: 'Set your foundation.', detail: 'Personal targets, dietary exclusions, and preferences.' },
  { id: 'settings', label: 'Backup & Settings', title: 'Keep your workspace yours.', detail: 'Household preferences, data backup, and exports.' },
] as const;
type TabId = (typeof TABS)[number]['id'];
function isTabId(value: string | null): value is TabId { return Boolean(value && TABS.some((tab) => tab.id === value)); }

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [showBuilder, setShowBuilder] = useState(false);
  const [ready, setReady] = useState(false);
  const workspaceStorageAvailable = useWorkspaceStore((s) => s.storageAvailable);
  const recipeStorageAvailable = useRecipeWeekStore((s) => s.storageAvailable);
  const storageAvailable = workspaceStorageAvailable && recipeStorageAvailable;
  const current = TABS.find((tab) => tab.id === activeTab)!;
  const navigate = (tab: TabId) => {
    setActiveTab(tab);
    setShowBuilder(false);
    const url = new URL(window.location.href);
    if (tab === 'recipeWeek') url.searchParams.set('view', 'recipeWeek');
    else url.searchParams.delete('view');
    window.history.replaceState(null, '', url);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };
  useEffect(() => {
    hydrateMealPlannerStore(); hydrateWorkspaceStore(); hydrateRecipeWeekStore();
    const requested = new URLSearchParams(window.location.search).get('view');
    if (isTabId(requested)) setActiveTab(requested);
    else if (requested) {
      const url = new URL(window.location.href);
      url.searchParams.delete('view');
      window.history.replaceState(null, '', url);
    }
    setReady(true);
  }, []);

  return <div className="btb-shell lg:pl-60">
    <a href="#planner-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-accent focus:p-3 focus:text-black">Skip to planner content</a>
    <aside className="btb-sidebar lg:fixed lg:inset-y-0 lg:left-0 lg:z-20 lg:flex lg:w-60 lg:flex-col">
      <div className="flex items-center justify-between px-5 py-5 lg:block lg:px-6 lg:py-8">
        <button className="text-left" aria-label="BTB Meal Planner overview" onClick={() => navigate('overview')}><span className="font-display text-3xl font-bold tracking-tight text-accent">BTB<span className="ml-2 inline-block h-5 w-0.5 bg-accent/50" aria-hidden="true" /></span><span className="ml-2 text-xs font-semibold uppercase tracking-widest text-slate-200">Meal Planner</span><span className="btb-eyebrow mt-1 hidden lg:block">BUILD THE BODY / NUTRITION</span></button>
        <a href="https://www.btbfitnessandhealth.com/" target="_blank" rel="noreferrer" className="text-xs text-slate-400 hover:text-accent lg:mt-4 lg:block">BTB Fitness & Health ↗</a>
      </div>
      <nav aria-label="Meal planner tools" className="btb-mobile-nav px-3 lg:block lg:flex-1 lg:overflow-y-auto lg:px-4 lg:pb-4">
        {TABS.map((tab, index) => <button key={tab.id} aria-pressed={activeTab === tab.id} className="btb-nav-item" onClick={() => navigate(tab.id)}><span className="btb-nav-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>{tab.label}</button>)}
      </nav>
      <div className="hidden border-t border-surface-border p-6 lg:block"><p className="font-display text-sm font-semibold uppercase leading-relaxed text-slate-300">Stay consistent.<br />Stay disciplined.<br /><span className="text-accent">Build the body.</span></p><p className="mt-3 text-[10px] text-slate-500">Your data stays in this browser.</p></div>
    </aside>
    <div className="btb-content min-h-screen">
      <div className="mx-auto max-w-[1480px] px-4 py-7 sm:px-7 lg:px-10 lg:py-9">
        <header className="no-print mb-7">
          <div className="flex items-start justify-between gap-4"><div><p className="btb-eyebrow text-accent">BTB MEAL PLANNER / {current.label}</p><h1 className="mt-3 text-3xl font-bold uppercase tracking-tight text-slate-100 sm:text-4xl xl:text-5xl">{current.title}</h1><p className="mt-3 max-w-2xl text-sm text-slate-400">{current.detail}</p></div><span className="hidden rounded-md border border-surface-border px-3 py-2 font-mono text-[10px] text-slate-400 sm:block">{ready ? new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }) : 'LOCAL WORKSPACE'}</span></div>
          <div className="btb-hero-rule mt-7" />
        </header>
        {!storageAvailable && <p role="status" className="mb-5 rounded-lg border border-accent-amber/30 bg-accent-amber/10 p-3 text-sm text-accent-amber">Browser storage is unavailable or full. New workspace changes may not survive reload; export a backup before leaving.</p>}
        <main id="planner-content" tabIndex={-1}>
          {!ready ? <p role="status" className="text-sm text-slate-400">Loading your local workspace…</p> : <>
          {activeTab === 'overview' && <PlannerOverview navigate={navigate} />}
          {activeTab === 'recipeWeek' && <RecipeWeekPlanner />}
          {activeTab === 'week' && <WeeklyPlanner onOpenDaily={() => navigate('meals')} onOpenPrep={() => navigate('prep')} />}
          {activeTab === 'prep' && <MealPrepHub onOpenPlan={() => navigate('week')} onOpenShopping={() => navigate('shopping')} />}
          {activeTab === 'shopping' && <ShoppingWorkspace onOpenPlan={() => navigate('week')} onOpenPantry={() => navigate('grocery')} />}
          {activeTab === 'profile' && <ProfileSetupForm />}
          {activeTab === 'meals' && <MealPlanView />}
          {activeTab === 'tracker' && <EnergyTracker />}
          {activeTab === 'grocery' && <GroceryEstimator />}
          {activeTab === 'portion' && <PortionGallery />}
          {activeTab === 'history' && <HistoryTracker />}
          {activeTab === 'recipes' && <div className="space-y-6"><div className="no-print flex justify-end"><button className="btb-button" onClick={() => setShowBuilder(!showBuilder)}>{showBuilder ? 'Close recipe builder' : '+ Create a recipe'}</button></div>{showBuilder && <RecipeBuilder />}<RecipeBox /></div>}
          {activeTab === 'foodLogger' && <FoodLogger />}
          {activeTab === 'settings' && <WorkspaceSettings />}
          </>}
        </main>
        <footer className="no-print mt-10 space-y-2 border-t border-surface-border pt-5 text-[11px] leading-relaxed text-slate-500">
          <p><strong className="text-slate-300">BTB Meal Planner</strong> · Nutrition, portions, preparation times, and grocery prices are estimates. Check package labels and allergens; dietary flags are not an allergy-safety guarantee.</p>
          <p>Food images are illustrative; some are generated. Preparation and portion size can vary. Ingredient artwork: <a className="underline" href="https://www.themealdb.com/" target="_blank" rel="noreferrer">TheMealDB</a>. Product photos: their respective brands. <a className="underline" href="/images/foods/product-sources.json" target="_blank" rel="noreferrer">Image sources</a>.</p>
          <p>Profile, plans, recipes, and logs are saved locally when browser storage is available. No cloud account sync. <button className="underline hover:text-accent" onClick={() => navigate('settings')}>Export your backup</button>.</p>
        </footer>
      </div>
    </div>
  </div>;
}
