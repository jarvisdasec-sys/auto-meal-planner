'use client';

import { useState } from 'react';
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
    </div>
  );
}
