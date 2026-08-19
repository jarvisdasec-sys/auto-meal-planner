'use client';

import { useMemo } from 'react';
import { useMealPlannerStore } from '@/store/useMealPlannerStore';
import { calculateMetabolicSummary } from '@/lib/fitnessMealPlanner';
import type { Goal, SnackCraving, StoreName } from '@/lib/fitnessMealPlanner';
import Card from './ui/Card';

const ACTIVITY_LEVELS: { value: number; label: string }[] = [
  { value: 1.2, label: 'Sedentary (little/no exercise)' },
  { value: 1.375, label: 'Lightly active (1-3 days/week)' },
  { value: 1.55, label: 'Moderately active (3-5 days/week)' },
  { value: 1.725, label: 'Very active (6-7 days/week)' },
  { value: 1.9, label: 'Extremely active (athlete/physical job)' },
];

const GOALS: { value: Goal; label: string }[] = [
  { value: 'fat_loss', label: 'Fat Loss' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'muscle_gain', label: 'Muscle Gain' },
];

const STORES: { value: StoreName; label: string }[] = [
  { value: 'walmart', label: 'Walmart' },
  { value: 'foodLion', label: 'Food Lion' },
  { value: 'aldi', label: 'Aldi' },
  { value: 'kroger', label: 'Kroger' },
];

const SNACK_CRAVINGS: SnackCraving[] = ['salty', 'sweet', 'crunchy', 'savory', 'high_protein'];

export default function ProfileSetupForm() {
  const profile = useMealPlannerStore((s) => s.profile);
  const updateProfile = useMealPlannerStore((s) => s.updateProfile);
  const setGoal = useMealPlannerStore((s) => s.setGoal);
  const setPreferredStore = useMealPlannerStore((s) => s.setPreferredStore);
  const toggleSnackCraving = useMealPlannerStore((s) => s.toggleSnackCraving);

  const summary = useMemo(() => calculateMetabolicSummary(profile), [profile]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <Card title="Your Profile" subtitle="Update your stats to recalculate targets live" className="lg:col-span-3">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Height (cm)">
            <input
              type="number"
              value={profile.heightCm}
              onChange={(e) => updateProfile({ heightCm: Number(e.target.value) })}
              className="input"
            />
          </Field>
          <Field label="Weight (kg)">
            <input
              type="number"
              value={profile.currentWeightKg}
              onChange={(e) => updateProfile({ currentWeightKg: Number(e.target.value) })}
              className="input"
            />
          </Field>
          <Field label="Age">
            <input
              type="number"
              value={profile.age}
              onChange={(e) => updateProfile({ age: Number(e.target.value) })}
              className="input"
            />
          </Field>
          <Field label="Gender">
            <select
              value={profile.gender}
              onChange={(e) => updateProfile({ gender: e.target.value as 'male' | 'female' })}
              className="input"
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </Field>
          <Field label="Activity Level" full>
            <select
              value={profile.activityLevel}
              onChange={(e) => updateProfile({ activityLevel: Number(e.target.value) })}
              className="input"
            >
              {ACTIVITY_LEVELS.map((level) => (
                <option key={level.value} value={level.value}>
                  {level.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Goal" full>
            <div className="flex flex-wrap gap-2">
              {GOALS.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => setGoal(g.value)}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    profile.goal === g.value
                      ? 'bg-accent text-white'
                      : 'bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Preferred Store" full>
            <div className="flex flex-wrap gap-2">
              {STORES.map((store) => (
                <button
                  key={store.value}
                  type="button"
                  onClick={() => setPreferredStore(store.value)}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    profile.preferredStore === store.value
                      ? 'bg-accent text-white'
                      : 'bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {store.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Snack Cravings" full>
            <div className="flex flex-wrap gap-2">
              {SNACK_CRAVINGS.map((craving) => {
                const active = profile.snackCravings.includes(craving);
                return (
                  <label
                    key={craving}
                    className={`cursor-pointer select-none rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                      active
                        ? 'border-accent-green bg-accent-green/10 text-accent-green'
                        : 'border-surface-border bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mr-2 accent-accent-green"
                      checked={active}
                      onChange={() => toggleSnackCraving(craving)}
                    />
                    {craving.replace('_', ' ')}
                  </label>
                );
              })}
            </div>
          </Field>
        </div>
      </Card>

      <Card title="Live Metabolic Summary" subtitle="Updates automatically as you edit your profile" className="lg:col-span-2">
        <div className="space-y-3">
          <Stat label="BMR" value={`${Math.round(summary.bmr)} kcal`} />
          <Stat label="TDEE" value={`${Math.round(summary.tdee)} kcal`} />
          <Stat label="Target Calories" value={`${Math.round(summary.targetCalories)} kcal`} highlight />
          <div className="mt-2 grid grid-cols-3 gap-2">
            <MacroStat label="Protein" value={summary.macroTargets.proteinGrams} color="text-accent-green" />
            <MacroStat label="Carbs" value={summary.macroTargets.carbGrams} color="text-accent-amber" />
            <MacroStat label="Fats" value={summary.macroTargets.fatGrams} color="text-accent-red" />
          </div>
        </div>
      </Card>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label className="mb-1.5 block text-sm font-medium text-slate-300">{label}</label>
      {children}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
      <span className="text-sm text-slate-400">{label}</span>
      <span className={`text-base font-semibold ${highlight ? 'text-accent' : 'text-slate-100'}`}>{value}</span>
    </div>
  );
}

function MacroStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl bg-white/5 px-3 py-3 text-center">
      <div className={`text-lg font-bold ${color}`}>{Math.round(value)}g</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}
