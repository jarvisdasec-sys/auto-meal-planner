'use client';

import { useEffect, useState } from 'react';
import { hydrateMealPlannerStore } from '@/store/useMealPlannerStore';
import ProfileSetupForm from './ProfileSetupForm';
import MealPlanView from './MealPlanView';
import EnergyTracker from './EnergyTracker';
import GroceryEstimator from './GroceryEstimator';
import PortionGallery from './PortionGallery';
import HistoryTracker from './HistoryTracker';
import RecipeBox from './RecipeBox';
import FoodLogger from './FoodLogger';

const TABS = [
  { id: 'profile', label: 'Profile Setup' },
  { id: 'meals', label: 'Daily Meal Plan' },
  { id: 'tracker', label: 'Live Calorie Tracker' },
  { id: 'grocery', label: 'Grocery Estimator' },
  { id: 'portion', label: 'Portion' },
  { id: 'history', label: 'History' },
  { id: 'recipes', label: 'Recipe Box' },
  { id: 'foodLogger', label: 'Food Logger' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('profile');

  useEffect(() => {
    hydrateMealPlannerStore();
  }, []);

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">
          Fitness &amp; Meal Planner
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Plan meals, track energy balance, and manage grocery costs — all in one dashboard.
        </p>
      </header>

      <nav className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-surface-border bg-surface-card p-1.5">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-pressed={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 min-w-[140px] rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-accent text-white shadow-md shadow-accent/30'
                : 'text-slate-300 hover:bg-white/5 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main>
        {activeTab === 'profile' && <ProfileSetupForm />}
        {activeTab === 'meals' && <MealPlanView />}
        {activeTab === 'tracker' && <EnergyTracker />}
        {activeTab === 'grocery' && <GroceryEstimator />}
        {activeTab === 'portion' && <PortionGallery />}
        {activeTab === 'history' && <HistoryTracker />}
        {activeTab === 'recipes' && <RecipeBox />}
        {activeTab === 'foodLogger' && <FoodLogger />}
      </main>
      <footer className="mt-8 space-y-2 border-t border-surface-border pt-4 text-xs leading-relaxed text-slate-400">
        <p>Nutrition, hand portions and grocery prices are estimates. Check current package or restaurant labels for serving sizes and allergens; dietary flags are not an allergy-safety guarantee.</p>
        <p>Food images are illustrative and some are generated. Product flavor, packaging, preparation and portion size may vary. Ingredient artwork: <a className="underline hover:text-slate-200" href="https://www.themealdb.com/" target="_blank" rel="noreferrer">TheMealDB</a>. Product photos: their respective brands. <a className="underline hover:text-slate-200" href="/images/foods/product-sources.json" target="_blank" rel="noreferrer">Product image sources</a>.</p>
        <p>Your profile, plans and logs are saved in this browser when storage is available; this app does not provide cloud account sync.</p>
      </footer>
    </div>
  );
}
