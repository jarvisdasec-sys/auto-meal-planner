'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useMealPlannerStore } from '@/store/useMealPlannerStore';
import {
  calculateMetabolicSummary,
  cmToFeetInches,
  feetInchesToCm,
  kgToLbs,
  lbsToKg,
} from '@/lib/fitnessMealPlanner';
import type {
  Goal,
  SnackCraving,
  Allergen,
  GICondition,
  SpiceLevel,
  UserProfile,
} from '@/lib/fitnessMealPlanner';
import {
  MealPlannerValidationError,
  assertFiniteNumber,
  isMealPlannerValidationError,
  validateProfile,
} from '@/lib/mealPlannerValidation';
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

type DraftField = 'fullName' | 'height' | 'weightLbs' | 'age' | 'activityLevel' | 'customExclusions' | 'form';

type ProfileDraft = {
  fullName: string;
  heightFeet: string;
  heightInches: string;
  weightLbs: string;
  age: string;
  gender: UserProfile['gender'];
  activityLevel: string;
  goal: Goal;
  snackCravings: SnackCraving[];
  dietaryRestrictions: string[];
  preferredStore: UserProfile['preferredStore'];
  majorAllergens: Allergen[];
  giConditions: GICondition[];
  spiceLevel: SpiceLevel;
  customExclusions: string[];
};

function profileToDraft(profile: UserProfile): ProfileDraft {
  const { feet, inches } = cmToFeetInches(profile.heightCm);
  return {
    fullName: profile.fullName,
    heightFeet: String(feet),
    heightInches: String(inches),
    weightLbs: String(Math.round(kgToLbs(profile.currentWeightKg) * 10) / 10),
    age: String(profile.age),
    gender: profile.gender,
    activityLevel: String(profile.activityLevel),
    goal: profile.goal,
    snackCravings: [...profile.snackCravings],
    dietaryRestrictions: [...profile.dietaryRestrictions],
    preferredStore: profile.preferredStore,
    majorAllergens: [...profile.majorAllergens],
    giConditions: [...profile.giConditions],
    spiceLevel: profile.spiceLevel,
    customExclusions: [...profile.customExclusions],
  };
}

function arraysMatch(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function draftsMatch(left: ProfileDraft, right: ProfileDraft): boolean {
  return left.fullName === right.fullName
    && left.heightFeet === right.heightFeet
    && left.heightInches === right.heightInches
    && left.weightLbs === right.weightLbs
    && left.age === right.age
    && left.gender === right.gender
    && left.activityLevel === right.activityLevel
    && left.goal === right.goal
    && left.preferredStore === right.preferredStore
    && left.spiceLevel === right.spiceLevel
    && arraysMatch(left.snackCravings, right.snackCravings)
    && arraysMatch(left.dietaryRestrictions, right.dietaryRestrictions)
    && arraysMatch(left.majorAllergens, right.majorAllergens)
    && arraysMatch(left.giConditions, right.giConditions)
    && arraysMatch(left.customExclusions, right.customExclusions);
}

function readDraftNumber(
  rawValue: string,
  field: string,
  options: { min?: number; max?: number; allowZero?: boolean } = {},
): number {
  const value = rawValue.trim();
  if (!value) throw new MealPlannerValidationError(`${field} is required.`);
  return assertFiniteNumber(Number(value), field, options);
}

/** Converts display units only; shared validateProfile remains the profile authority. */
function draftToCandidate(draft: ProfileDraft): Partial<UserProfile> {
  const heightFeet = readDraftNumber(draft.heightFeet, 'Height (feet)', { min: 0, max: 10, allowZero: true });
  // Extra inches are intentionally accepted and normalized by conversion after a successful save.
  const heightInches = readDraftNumber(draft.heightInches, 'Height (inches)', { min: 0, max: 119, allowZero: true });

  return {
    fullName: draft.fullName,
    heightCm: feetInchesToCm(heightFeet, heightInches),
    currentWeightKg: lbsToKg(readDraftNumber(draft.weightLbs, 'Weight')),
    age: readDraftNumber(draft.age, 'Age'),
    gender: draft.gender,
    activityLevel: readDraftNumber(draft.activityLevel, 'Activity level'),
    goal: draft.goal,
    snackCravings: [...draft.snackCravings],
    dietaryRestrictions: [...draft.dietaryRestrictions],
    preferredStore: draft.preferredStore,
    majorAllergens: [...draft.majorAllergens],
    giConditions: [...draft.giConditions],
    spiceLevel: draft.spiceLevel,
    customExclusions: [...draft.customExclusions],
  };
}

function fieldForValidationError(error: unknown): DraftField {
  const message = error instanceof Error ? error.message : '';
  if (/full name/i.test(message)) return 'fullName';
  if (/height/i.test(message)) return 'height';
  if (/weight/i.test(message)) return 'weightLbs';
  if (/age/i.test(message)) return 'age';
  if (/activity/i.test(message)) return 'activityLevel';
  if (/custom exclusions/i.test(message)) return 'customExclusions';
  return 'form';
}

function toggleValue<T extends string>(items: T[], item: T): T[] {
  return items.includes(item) ? items.filter((current) => current !== item) : [...items, item];
}

export default function ProfileSetupForm() {
  const profile = useMealPlannerStore((state) => state.profile);
  const updateProfile = useMealPlannerStore((state) => state.updateProfile);

  const [draft, setDraft] = useState<ProfileDraft>(() => profileToDraft(profile));
  const [exclusionInput, setExclusionInput] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<DraftField, string>>>({});
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved'>('saved');
  const hasActiveEdits = useRef(false);
  const latestDraft = useRef(draft);

  useEffect(() => { latestDraft.current = draft; }, [draft]);

  const savedDraft = useMemo(() => profileToDraft(profile), [profile]);
  const hasUnsavedChanges = !draftsMatch(draft, savedDraft);

  // Hydration replaces the default store profile after first client render. Adopt that
  // profile only while this form has no active edits, so a user's in-progress draft wins.
  useEffect(() => {
    if (hasActiveEdits.current && !draftsMatch(latestDraft.current, profileToDraft(profile))) return;
    hasActiveEdits.current = false;
    setDraft(profileToDraft(profile));
    setFieldErrors({});
    setSaveStatus('saved');
  }, [profile]);

  const summary = useMemo(() => {
    try {
      return calculateMetabolicSummary(validateProfile(draftToCandidate(draft), profile));
    } catch {
      // Never render calculations based on an invalid transient draft; retain saved values instead.
      return calculateMetabolicSummary(profile);
    }
  }, [draft, profile]);

  const changeDraft = (change: (current: ProfileDraft) => ProfileDraft, fields: DraftField[] = []) => {
    hasActiveEdits.current = true;
    setDraft(change);
    setSaveStatus('unsaved');
    if (fields.length) {
      setFieldErrors((current) => {
        const next = { ...current };
        fields.forEach((field) => delete next[field]);
        delete next.form;
        return next;
      });
    }
  };

  const addExclusion = () => {
    const value = exclusionInput.trim();
    if (!value) {
      setFieldErrors((current) => ({ ...current, customExclusions: 'Enter an ingredient to exclude.' }));
      return;
    }
    if (draft.customExclusions.some((item) => item.toLowerCase() === value.toLowerCase())) {
      setFieldErrors((current) => ({ ...current, customExclusions: 'That ingredient is already excluded.' }));
      return;
    }
    changeDraft((current) => ({ ...current, customExclusions: [...current.customExclusions, value] }), ['customExclusions']);
    setExclusionInput('');
  };

  const removeExclusion = (value: string) => {
    changeDraft(
      (current) => ({ ...current, customExclusions: current.customExclusions.filter((item) => item !== value) }),
      ['customExclusions'],
    );
  };

  const handleSaveProfile = () => {
    try {
      // This validates all current draft preferences plus converted display units before one store commit.
      const validatedProfile = validateProfile(draftToCandidate(draft), profile);
      updateProfile(validatedProfile);
      hasActiveEdits.current = false;
      setDraft(profileToDraft(validatedProfile));
      setFieldErrors({});
      setSaveStatus('saved');
    } catch (error) {
      const message = isMealPlannerValidationError(error) || error instanceof Error
        ? error.message
        : 'Unable to save your profile. Please review the fields and try again.';
      setFieldErrors({ [fieldForValidationError(error)]: message });
      setSaveStatus('unsaved');
    }
  };

  const statusText = hasUnsavedChanges || saveStatus === 'unsaved' ? 'Unsaved changes.' : 'Profile saved.';

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <Card title="Your Profile" subtitle="Update your stats to recalculate targets live" className="lg:col-span-3">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Full Name" full error={fieldErrors.fullName} errorId="profile-full-name-error">
            <input
              type="text"
              value={draft.fullName}
              onChange={(event) => changeDraft((current) => ({ ...current, fullName: event.target.value }), ['fullName'])}
              placeholder="e.g. Jordan Smith"
              className="input"
              aria-label="Full Name"
              aria-invalid={Boolean(fieldErrors.fullName)}
              aria-describedby={fieldErrors.fullName ? 'profile-full-name-error' : undefined}
            />
          </Field>
          <Field label="Height (ft / in)" error={fieldErrors.height} errorId="profile-height-error">
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={draft.heightFeet}
                onChange={(event) => changeDraft((current) => ({ ...current, heightFeet: event.target.value }), ['height'])}
                className="input"
                placeholder="ft"
                aria-label="Height feet"
                aria-invalid={Boolean(fieldErrors.height)}
                aria-describedby={fieldErrors.height ? 'profile-height-error' : undefined}
              />
              <input
                type="text"
                inputMode="numeric"
                value={draft.heightInches}
                onChange={(event) => changeDraft((current) => ({ ...current, heightInches: event.target.value }), ['height'])}
                className="input"
                placeholder="in"
                aria-label="Height inches"
                aria-invalid={Boolean(fieldErrors.height)}
                aria-describedby={fieldErrors.height ? 'profile-height-error' : undefined}
              />
            </div>
          </Field>
          <Field label="Weight (lbs)" error={fieldErrors.weightLbs} errorId="profile-weight-error">
            <input
              type="text"
              inputMode="decimal"
              value={draft.weightLbs}
              onChange={(event) => changeDraft((current) => ({ ...current, weightLbs: event.target.value }), ['weightLbs'])}
              className="input"
              aria-label="Weight (lbs)"
              aria-invalid={Boolean(fieldErrors.weightLbs)}
              aria-describedby={fieldErrors.weightLbs ? 'profile-weight-error' : undefined}
            />
          </Field>
          <Field label="Age" error={fieldErrors.age} errorId="profile-age-error">
            <input
              type="text"
              inputMode="numeric"
              value={draft.age}
              onChange={(event) => changeDraft((current) => ({ ...current, age: event.target.value }), ['age'])}
              className="input"
              aria-label="Age"
              aria-invalid={Boolean(fieldErrors.age)}
              aria-describedby={fieldErrors.age ? 'profile-age-error' : undefined}
            />
          </Field>
          <Field label="Gender">
            <select
              value={draft.gender}
              onChange={(event) => changeDraft((current) => ({ ...current, gender: event.target.value as UserProfile['gender'] }))}
              className="input"
              aria-label="Gender"
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </Field>
          <Field label="Activity Level" full error={fieldErrors.activityLevel} errorId="profile-activity-error">
            <select
              value={draft.activityLevel}
              onChange={(event) => changeDraft((current) => ({ ...current, activityLevel: event.target.value }), ['activityLevel'])}
              className="input"
              aria-label="Activity Level"
              aria-invalid={Boolean(fieldErrors.activityLevel)}
              aria-describedby={fieldErrors.activityLevel ? 'profile-activity-error' : undefined}
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
              {GOALS.map((goal) => (
                <button
                  key={goal.value}
                  type="button"
                  onClick={() => changeDraft((current) => ({ ...current, goal: goal.value }))}
                  aria-pressed={draft.goal === goal.value}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    draft.goal === goal.value
                      ? 'bg-accent text-white'
                      : 'bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {goal.label}
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
                  onClick={() => changeDraft((current) => ({ ...current, preferredStore: store }))}
                  aria-pressed={draft.preferredStore === store}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    draft.preferredStore === store
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
                const active = draft.snackCravings.includes(craving);
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
                      onChange={() => changeDraft((current) => ({
                        ...current,
                        snackCravings: toggleValue(current.snackCravings, craving),
                      }))}
                    />
                    {craving.replace('_', ' ')}
                  </label>
                );
              })}
            </div>
          </Field>
        </div>

        <div className="mt-6 space-y-2">
          <button
            type="button"
            onClick={handleSaveProfile}
            aria-label="Save profile changes"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 font-semibold text-white shadow-lg shadow-accent/30 transition-colors duration-200 hover:bg-accent/90"
          >
            Save Profile Changes
          </button>
          <p className={statusText === 'Profile saved.' ? 'text-center text-sm text-accent-green' : 'text-center text-sm text-accent-amber'} role="status" aria-live="polite">
            {statusText}
          </p>
          {fieldErrors.form && <p className="text-sm text-accent-red" role="alert">{fieldErrors.form}</p>}
        </div>
      </Card>

      <div className="space-y-6 lg:col-span-2">
        <Card title="Live Metabolic Summary" subtitle="Updates automatically from valid profile edits">
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
                const active = draft.majorAllergens.includes(allergen);
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
                      onChange={() => changeDraft((current) => ({
                        ...current,
                        majorAllergens: toggleValue(current.majorAllergens, allergen),
                      }))}
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
                const active = draft.giConditions.includes(condition);
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
                      onChange={() => changeDraft((current) => ({
                        ...current,
                        giConditions: toggleValue(current.giConditions, condition),
                      }))}
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
                  onClick={() => changeDraft((current) => ({ ...current, spiceLevel: level }))}
                  aria-pressed={draft.spiceLevel === level}
                  className={`rounded-lg px-3 py-2 text-sm font-medium capitalize transition-colors ${
                    draft.spiceLevel === level
                      ? 'bg-accent text-white'
                      : 'bg-white/5 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {formatLabel(level)}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Custom Exclusions (typed ingredients)" error={fieldErrors.customExclusions} errorId="profile-exclusions-error">
            <div className="flex gap-2">
              <input
                type="text"
                value={exclusionInput}
                onChange={(event) => {
                  setExclusionInput(event.target.value);
                  setFieldErrors((current) => ({ ...current, customExclusions: undefined }));
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addExclusion();
                  }
                }}
                placeholder="e.g. cilantro"
                className="input"
                aria-label="Custom exclusion"
                aria-invalid={Boolean(fieldErrors.customExclusions)}
                aria-describedby={fieldErrors.customExclusions ? 'profile-exclusions-error' : undefined}
              />
              <button
                type="button"
                onClick={addExclusion}
                className="rounded-lg bg-accent/90 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-accent"
              >
                Add
              </button>
            </div>
            {draft.customExclusions.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {draft.customExclusions.map((item) => (
                  <span
                    key={item}
                    className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs text-slate-200"
                  >
                    {item}
                    <button
                      type="button"
                      onClick={() => removeExclusion(item)}
                      aria-label={`Remove ${item} exclusion`}
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

function Field({
  label,
  children,
  full,
  error,
  errorId,
}: {
  label: string;
  children: ReactNode;
  full?: boolean;
  error?: string;
  errorId?: string;
}) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <div className="mb-1.5 text-sm font-medium text-slate-300">{label}</div>
      {children}
      {error && <p id={errorId} className="mt-1.5 text-sm text-accent-red" role="alert">{error}</p>}
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
