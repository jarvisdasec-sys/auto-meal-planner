import type {
  ActivityLevel,
  Allergen,
  Gender,
  GICondition,
  Goal,
  SnackCraving,
  SpiceLevel,
  StoreName,
  UserProfile,
} from './fitnessMealPlanner';

export class MealPlannerValidationError extends Error {
  readonly code: string;

  constructor(message: string, code = 'INVALID_INPUT') {
    super(message);
    this.name = 'MealPlannerValidationError';
    this.code = code;
  }
}

const GENDERS: readonly Gender[] = ['male', 'female'];
const GOALS: readonly Goal[] = ['fat_loss', 'maintenance', 'muscle_gain'];
const STORES: readonly StoreName[] = [
  'walmart', 'kroger', 'albertsons', 'aldi', 'costco', 'wholeFoods', 'traderJoes', 'target', 'samsClub', 'publix',
];
const SNACKS: readonly SnackCraving[] = ['salty', 'sweet', 'crunchy', 'savory', 'high_protein'];
const ALLERGENS: readonly Allergen[] = ['peanuts', 'tree_nuts', 'milk', 'eggs', 'fish', 'shellfish', 'soy', 'wheat', 'sesame'];
const GI_CONDITIONS: readonly GICondition[] = ['low_fodmap_ibs', 'acid_reflux_gerd', 'lactose_intolerance', 'gluten_sensitivity', 'sensitive_stomach'];
const SPICE_LEVELS: readonly SpiceLevel[] = ['none', 'mild', 'medium', 'spicy'];

export const PROFILE_LIMITS = {
  heightCm: { min: 90, max: 250 },
  weightKg: { min: 25, max: 400 },
  age: { min: 13, max: 120 },
  activityLevel: { min: 1.1, max: 2.5 },
} as const;

function isOneOf<T extends string>(value: unknown, choices: readonly T[]): value is T {
  return typeof value === 'string' && choices.includes(value as T);
}

function uniqueStrings(value: unknown, field: string, allowed?: readonly string[]): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new MealPlannerValidationError(`${field} must be a list.`);
  const normalized = value.map((item) => {
    if (typeof item !== 'string' || !item.trim()) throw new MealPlannerValidationError(`${field} contains an invalid value.`);
    const result = item.trim();
    if (allowed && !allowed.includes(result)) throw new MealPlannerValidationError(`${field} contains an unsupported value: ${result}.`);
    return result;
  });
  return [...new Set(normalized)];
}

/** Require a finite numeric value within an intentional, non-medical UI bound. */
export function assertFiniteNumber(
  value: unknown,
  field: string,
  options: { min?: number; max?: number; allowZero?: boolean } = {},
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new MealPlannerValidationError(`${field} must be a finite number.`);
  }
  const min = options.min ?? (options.allowZero ? 0 : Number.MIN_VALUE);
  if (value < min || (!options.allowZero && value === 0)) {
    throw new MealPlannerValidationError(`${field} must be ${options.allowZero ? 'zero or greater' : 'greater than zero'}.`);
  }
  if (options.max !== undefined && value > options.max) {
    throw new MealPlannerValidationError(`${field} must be no greater than ${options.max}.`);
  }
  return value;
}

export function assertRequiredName(value: unknown, field = 'Name'): string {
  if (typeof value !== 'string' || !value.trim()) throw new MealPlannerValidationError(`${field} is required.`);
  const name = value.trim();
  if (name.length > 160) throw new MealPlannerValidationError(`${field} is too long.`);
  return name;
}

export interface NutritionValues {
  calories: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
}

/** Validate a complete food nutrition snapshot. Zero-calorie foods remain valid. */
export function validateNutrition(values: NutritionValues): NutritionValues {
  return {
    calories: assertFiniteNumber(values.calories, 'Calories', { min: 0, max: 10000, allowZero: true }),
    proteinGrams: assertFiniteNumber(values.proteinGrams, 'Protein', { min: 0, max: 2000, allowZero: true }),
    carbGrams: assertFiniteNumber(values.carbGrams, 'Carbs', { min: 0, max: 2000, allowZero: true }),
    fatGrams: assertFiniteNumber(values.fatGrams, 'Fat', { min: 0, max: 2000, allowZero: true }),
  };
}

export function validateServings(value: unknown): number {
  return assertFiniteNumber(value, 'Servings', { min: 0.01, max: 100 });
}

export function validateExercise(values: { activityName: unknown; durationMinutes: unknown; caloriesBurned: unknown }) {
  return {
    activityName: assertRequiredName(values.activityName, 'Activity name'),
    durationMinutes: assertFiniteNumber(values.durationMinutes, 'Exercise duration', { min: 1, max: 1440 }),
    caloriesBurned: assertFiniteNumber(values.caloriesBurned, 'Calories burned', { min: 0, max: 20000, allowZero: true }),
  };
}

export function validateHydrationOunces(value: unknown): number {
  return assertFiniteNumber(value, 'Water amount', { min: 0.1, max: 640 });
}

/**
 * Merge a legacy profile with safe defaults and reject invalid submitted values.
 * Callers should only commit the returned object after this succeeds.
 */
export function validateProfile(
  candidate: Partial<UserProfile>,
  defaults: UserProfile,
): UserProfile {
  const merged = { ...defaults, ...candidate } as UserProfile;
  const fullName = assertRequiredName(merged.fullName, 'Full name');
  const heightCm = assertFiniteNumber(merged.heightCm, 'Height', PROFILE_LIMITS.heightCm);
  const currentWeightKg = assertFiniteNumber(merged.currentWeightKg, 'Weight', PROFILE_LIMITS.weightKg);
  const age = assertFiniteNumber(merged.age, 'Age', PROFILE_LIMITS.age);
  if (!Number.isInteger(age)) throw new MealPlannerValidationError('Age must be a whole number.');
  const activityLevel = assertFiniteNumber(merged.activityLevel, 'Activity level', PROFILE_LIMITS.activityLevel);
  if (!isOneOf(merged.gender, GENDERS)) throw new MealPlannerValidationError('Gender must be male or female.');
  if (!isOneOf(merged.goal, GOALS)) throw new MealPlannerValidationError('Goal is not supported.');
  if (!isOneOf(merged.preferredStore, STORES)) throw new MealPlannerValidationError('Preferred store is not supported.');
  if (!isOneOf(merged.spiceLevel, SPICE_LEVELS)) throw new MealPlannerValidationError('Spice level is not supported.');

  return {
    fullName,
    heightCm,
    currentWeightKg,
    age,
    gender: merged.gender,
    activityLevel: activityLevel as ActivityLevel | number,
    goal: merged.goal,
    snackCravings: uniqueStrings(merged.snackCravings, 'Snack cravings', SNACKS) as SnackCraving[],
    dietaryRestrictions: uniqueStrings(merged.dietaryRestrictions, 'Dietary restrictions'),
    preferredStore: merged.preferredStore,
    majorAllergens: uniqueStrings(merged.majorAllergens, 'Major allergens', ALLERGENS) as Allergen[],
    giConditions: uniqueStrings(merged.giConditions, 'GI conditions', GI_CONDITIONS) as GICondition[],
    spiceLevel: merged.spiceLevel,
    customExclusions: uniqueStrings(merged.customExclusions, 'Custom exclusions').map((item) => item.toLowerCase()),
  };
}

/** Validation errors are deliberately catchable by UI forms without string matching. */
export function isMealPlannerValidationError(error: unknown): error is MealPlannerValidationError {
  return error instanceof MealPlannerValidationError;
}
