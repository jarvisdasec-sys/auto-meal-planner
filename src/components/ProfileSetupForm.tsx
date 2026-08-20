'use client';

import { useMemo, useState } from 'react';
import { useMealPlannerStore } from '@/store/useMealPlannerStore';
import {
  calculateMetabolicSummary,
  cmToFeetInches,
  feetInchesToCm,
  kgToLbs,
  lbsToKg,
} from '@/lib/fitnessMealPlanner';
import type { Goal, SnackCraving, Allergen, GICondition, SpiceLevel } from '@/lib/fitnessMealPlanner';
import { STORE_LABELS, STORE_NAMES } from '@/lib/stores';
import { formatLabel } from '@/lib/format';
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

const SNACK_CRAVINGS: SnackCraving[] = ['salty', 'sweet', 'crunchy', 'savory', 'high_protein'];

const MAJOR_ALLERGENS: Allergen[] = [
  'peanuts',
  'tree_nuts',
  'milk',
  'eggs',
  'fish',
  'shellfish',
  'soy',
  'wheat',
  'sesame',
];

const GI_CONDITIONS: GICondition[] = [
  'low_fodmap_ibs',
  'acid_reflux_gerd',
  'lactose_intolerance',
  'gluten_sensitivity',
  'sensitive_stomach',
];

const SPICE_LEVELS: SpiceLevel[] = ['none', 'mild', 'medium', 'spicy'];

export default function ProfileSetupForm() {
  const profile = useMealPlannerStore((s) => s.profile);
  const updateProfile = useMealPlannerStore((s) => s.updateProfile);
  const setGoal = useMealPlannerStore((s) => s.setGoal);
  const setPreferredStore = useMealPlannerStore((s) => s.setPreferredStore);
  const toggleSnackCraving = useMealPlannerStore((s) => s.toggleSnackCraving);
  const toggleAllergen = useMealPlannerStore((s) => s.toggleAllergen);
  const toggleGICondition = useMealPlannerStore((s) => s.toggleGICondition);
  const setSpiceLevel = useMealPlannerStore((s) => s.setSpiceLevel);
  const setCustomExclusions = useMealPlannerStore((s) => s.setCustomExclusions);

  const [exclusionInput, setExclusionInput] = useState('');

  const [heightFeet, setHeightFeet] = useState(() => cmToFeetInches(profile.heightCm).feet);
  const [heightInches, setHeightInches] = useState(() => cmToFeetInches(profile.heightCm).inches);
  const [weightLbs, setWeightLbs] = useState(() => Math.round(kgToLbs(profile.currentWeightKg)));

  const summary = useMemo(() => calculateMetabolicSummary(profile), [profile]);

  const handleHeightChange = (feet: number, inches: number) => {
    setHeightFeet(feet);
    setHeightInches(inches);
    updateProfile({ heightCm: feetInchesToCm(feet, inches) });
  };

  const handleWeightChange = (lbs: number) => {
    setWeightLbs(lbs);
    updateProfile({ currentWeightKg: lbsToKg(lbs) });
  };

  const addExclusion = () => {
    const value = exclusionInput.trim();
    if (!value || profile.customExclusions.includes(value)) return;
    setCustomExclusions([...profile.customExclusions, value]);
    setExclusionInput('');
  };

  const removeExclusion = (value: string) => {
    setCustomExclusions(profile.customExclusions.filter((item) => item !== value));
  };

  const [isSaved, setIsSaved] = useState(false);

  const handleSaveProfile = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <Card title="Your Profile" subtitle="Update your stats to recalculate targets live" className="lg:col-span-3">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Full Name" full>
            <input
              type="text"
              value={profile.fullName}
              onChange={(e) => updateProfile({ fullName: e.target.value })}
              placeholder="e.g. Jordan Smith"
              className="input"
            />
          </Field>
          <Field label="Height (ft / in)">
            <div className="flex gap-2">
              <input
                type="number"
                value={heightFeet}
                onChange={(e) => handleHeightChange(Number(e.target.value), heightInches)}
                className="input"
                placeholder="ft"
              />
              <input
                type="number"
                value={heightInches}
                onChange={(e) => handleHeightChange(heightFeet, Number(e.target.value))}
                className="input"
                placeholder="in"
              />
            </div>
          </Field>
          <Field label="Weight (lbs)">
            <input
              type="number"
              value={weightLbs}
              onChange={(e) => handleWeightChange(Number(e.target.value))}
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
              {STORE_NAMES.map((store) => (
                <button
                  key={store}
                  type="button"
                  onClick={() => setPreferredStore(store)}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    profile.preferredStore === store
                      ? 'bg-accent text-white'
                      : 'bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {STORE_LABELS[store]}
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

        <button
          type="button"
          onClick={handleSaveProfile}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 font-semibold text-white shadow-lg shadow-accent/30 transition-colors duration-200 hover:bg-accent/90"
        >
          {isSaved ? (
            <span className="flex items-center gap-2">✓ Profile Saved!</span>
          ) : (
            'Save Profile Changes'
          )}
        </button>
      </Card>

      <div className="space-y-6 lg:col-span-2">
        <Card title="Live Metabolic Summary" subtitle="Updates automatically as you edit your profile">
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

        <Card title="Understanding Your Numbers" subtitle="What BMR and TDEE actually mean">
          <div className="space-y-3 text-sm text-slate-300">
            <p>
              <span className="font-semibold text-accent-green">BMR (Basal Metabolic Rate):</span> the baseline
              calories your body burns at rest just to stay alive — breathing, circulating blood, and cell repair.
            </p>
            <p>
              <span className="font-semibold text-accent">TDEE (Total Daily Energy Expenditure):</span> your
              actual daily calorie burn, combining your BMR with daily movement, working out, and digestion.
            </p>
          </div>
        </Card>
      </div>

      <Card
        title="Allergies & Digestive Health"
        subtitle="Flagged foods are excluded from recommendations or shown with a warning badge"
        className="lg:col-span-5"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Major Allergens" full>
            <div className="flex flex-wrap gap-2">
              {MAJOR_ALLERGENS.map((allergen) => {
                const active = profile.majorAllergens.includes(allergen);
                return (
                  <label
                    key={allergen}
                    className={`cursor-pointer select-none rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                      active
                        ? 'border-accent-red bg-accent-red/10 text-accent-red'
                        : 'border-surface-border bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mr-2 accent-accent-red"
                      checked={active}
                      onChange={() => toggleAllergen(allergen)}
                    />
                    {formatLabel(allergen)}
                  </label>
                );
              })}
            </div>
          </Field>

          <Field label="GI Conditions" full>
            <div className="flex flex-wrap gap-2">
              {GI_CONDITIONS.map((condition) => {
                const active = profile.giConditions.includes(condition);
                return (
                  <label
                    key={condition}
                    className={`cursor-pointer select-none rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                      active
                        ? 'border-accent-amber bg-accent-amber/10 text-accent-amber'
                        : 'border-surface-border bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mr-2 accent-accent-amber"
                      checked={active}
                      onChange={() => toggleGICondition(condition)}
                    />
                    {formatLabel(condition)}
                  </label>
                );
              })}
            </div>
          </Field>

          <Field label="Spice Tolerance">
            <div className="flex flex-wrap gap-2">
              {SPICE_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setSpiceLevel(level)}
                  className={`rounded-lg px-3 py-2 text-sm font-medium capitalize transition-colors ${
                    profile.spiceLevel === level
                      ? 'bg-accent text-white'
                      : 'bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {formatLabel(level)}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Custom Exclusions (typed ingredients)">
            <div className="flex gap-2">
              <input
                type="text"
                value={exclusionInput}
                onChange={(e) => setExclusionInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addExclusion();
                  }
                }}
                placeholder="e.g. cilantro"
                className="input"
              />
              <button
                type="button"
                onClick={addExclusion}
                className="rounded-lg bg-accent/90 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-accent"
              >
                Add
              </button>
            </div>
            {profile.customExclusions.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {profile.customExclusions.map((item) => (
                  <span
                    key={item}
                    className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs text-slate-200"
                  >
                    {item}
                    <button
                      type="button"
                      onClick={() => removeExclusion(item)}
                      className="text-slate-400 hover:text-accent-red"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </Field>
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
