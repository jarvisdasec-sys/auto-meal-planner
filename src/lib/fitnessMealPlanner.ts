import { addDays, isDateKey, localDateKey, type DateKey } from './dateKeys';
import { assertFiniteNumber, validateServings } from './mealPlannerValidation';

/**
 * Fitness & Meal Planner Engine
 * Modular TypeScript engine for metabolic calculations, meal planning,
 * energy balance tracking, and grocery cost estimation.
 * Designed for easy integration into React / Next.js apps.
 */

// ============================================================
// 1. DATA MODELS & TYPES
// ============================================================

export type Gender = 'male' | 'female';

export type ActivityLevel = 1.2 | 1.3 | 1.375 | 1.4 | 1.5 | 1.55 | 1.6 | 1.7 | 1.725 | 1.8 | 1.9;

export type Goal = 'fat_loss' | 'maintenance' | 'muscle_gain';

export type SnackCraving = 'salty' | 'sweet' | 'crunchy' | 'savory' | 'high_protein';

export type StoreName =
  | 'walmart'
  | 'kroger'
  | 'albertsons'
  | 'aldi'
  | 'costco'
  | 'wholeFoods'
  | 'traderJoes'
  | 'target'
  | 'samsClub'
  | 'publix';

export type MealWindow = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

export type Allergen =
  | 'peanuts'
  | 'tree_nuts'
  | 'milk'
  | 'eggs'
  | 'fish'
  | 'shellfish'
  | 'soy'
  | 'wheat'
  | 'sesame';

export type GICondition =
  | 'low_fodmap_ibs'
  | 'acid_reflux_gerd'
  | 'lactose_intolerance'
  | 'gluten_sensitivity'
  | 'sensitive_stomach';

export type SpiceLevel = 'none' | 'mild' | 'medium' | 'spicy';

export interface UserProfile {
  fullName: string;
  heightCm: number;
  currentWeightKg: number;
  age: number;
  gender: Gender;
  /** Activity multiplier, from 1.2 (sedentary) to 1.9 (extremely active) */
  activityLevel: ActivityLevel | number;
  goal: Goal;
  snackCravings: SnackCraving[];
  dietaryRestrictions: string[];
  preferredStore: StoreName;
  majorAllergens: Allergen[];
  giConditions: GICondition[];
  spiceLevel: SpiceLevel;
  customExclusions: string[];
}

export type EstimatedPrices = Record<StoreName, number>;

export type CookingMethod =
  | 'raw'
  | 'steamed'
  | 'boiled'
  | 'baked'
  | 'air_fried'
  | 'pan_fried'
  | 'deep_fried'
  | 'grilled';

export interface CookingOption {
  method: CookingMethod;
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  recommendedTempF?: number;
  macroMultiplier: {
    calories: number; // e.g., 1.0 for steaming, slightly lower for boiling fat off, etc.
    protein: number;
    carbs: number;
    fat: number;
  };
  addedFatGrams?: number; // Added oil/butter for pan frying
  cookingTip?: string;
}

export interface FoodItem {
  id: string;
  barcode: string;
  name: string;
  category: string;
  /** Raw portion size, e.g. "100g" */
  portionRaw: string;
  caloriesRaw: number;
  /** Cooked portion size, e.g. "85g" */
  portionCooked: string;
  caloriesCooked: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
  /**
   * Calorie basis represented by the one legacy P/C/F seed set. Missing catalog
   * values default to cooked-basis; raw/cooked conversions are estimates.
   */
  macroBasis?: MacroBasis;
  snackProfile: SnackCraving[];
  /** Estimated price (per portion/unit) at each supported store */
  estimatedPrices: EstimatedPrices;
  /** Explicit store prices entered by a user; these take precedence over static estimates. */
  knownPrices?: Partial<EstimatedPrices>;
  /** False explicitly marks a store price as unavailable rather than free. */
  priceAvailability?: Partial<Record<StoreName, boolean>>;
  /** High-quality food photo; UI falls back to a default category image when absent */
  imageUrl?: string;
  /** Available cooking methods with their macro/time impact */
  cookingOptions: CookingOption[];
  /** Allergen, FODMAP, GERD-trigger, and spice metadata used by the dietary safeguards engine */
  dietaryTags: DietaryTags;
  /** Optional ingredient names when the item represents a mixed food or recipe. */
  ingredients?: string[];
}

export interface DietaryTags {
  allergens: Allergen[];
  isHighFodmap: boolean;
  isGerdTrigger: boolean;
  containsGluten: boolean;
  containsLactose: boolean;
  spiceLevel: SpiceLevel;
}

export type MacroBasis = 'raw' | 'cooked';

// ============================================================
// COOKING METHOD & PREP ENGINE (oil/butter additions, macro adjustments)
// ============================================================

export type OilType = 'olive_oil' | 'butter' | 'coconut_oil' | 'avocado_oil';

export interface OilAddition {
  oilType: OilType;
  amount: number;
  unit: 'tbsp' | 'tsp';
  addedCalories: number;
  addedFatGrams: number;
}

// Calories/fat contributed per tablespoon of each added cooking fat
export const OIL_NUTRITION_PER_TBSP: Record<OilType, { calories: number; fatGrams: number }> = {
  olive_oil: { calories: 124, fatGrams: 14 },
  butter: { calories: 102, fatGrams: 11.5 },
  coconut_oil: { calories: 117, fatGrams: 13.6 },
  avocado_oil: { calories: 124, fatGrams: 14 },
};

const TSP_PER_TBSP = 3;

/** True when the cooking method typically requires an added-oil/butter input. */
export function requiresOilInput(method: CookingMethod): boolean {
  return method === 'pan_fried' || method === 'deep_fried';
}

/** Calculate the calories and fat added by a given amount of cooking oil or butter. */
export function calculateAddedOilCalories(
  oilType: OilType,
  amount: number,
  unit: 'tbsp' | 'tsp',
): { addedCalories: number; addedFatGrams: number } {
  assertFiniteNumber(amount, 'Oil amount', { min: 0, max: 32, allowZero: true });
  const tablespoons = unit === 'tsp' ? amount / TSP_PER_TBSP : amount;
  const perTbsp = OIL_NUTRITION_PER_TBSP[oilType];
  return {
    addedCalories: Math.round(perTbsp.calories * tablespoons),
    addedFatGrams: Math.round(perTbsp.fatGrams * tablespoons * 10) / 10,
  };
}

export interface AdjustedMacros {
  calories: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
}

/** Apply a cooking option's macro multiplier (and any inherent added fat) to a food's base macros. */
export function applyCookingOption(
  base: { calories: number; proteinGrams: number; carbGrams: number; fatGrams: number },
  option: CookingOption,
): AdjustedMacros {
  return {
    calories: Math.round(base.calories * option.macroMultiplier.calories),
    proteinGrams: Math.round(base.proteinGrams * option.macroMultiplier.protein * 10) / 10,
    carbGrams: Math.round(base.carbGrams * option.macroMultiplier.carbs * 10) / 10,
    fatGrams: Math.round((base.fatGrams * option.macroMultiplier.fat + (option.addedFatGrams ?? 0)) * 10) / 10,
  };
}

export type PortionMode = 'raw' | 'cooked';

export interface CalculatedFoodNutrition extends AdjustedMacros {
  portionMode: PortionMode;
  cookingMethod: CookingMethod;
  servings: number;
  oilAddition?: OilAddition;
  /** Source basis of the catalog's single P/C/F seed set. */
  macroBasis: MacroBasis;
  /** Approximate raw/cooked conversion applied to seed P/C/F values. */
  macroScale: number;
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Calculate one final nutrition snapshot for a catalog food. A catalog has one
 * P/C/F seed set, not separate laboratory measurements for raw and cooked
 * portions. `macroBasis` identifies that seed (legacy defaults to cooked), and
 * the selected calorie-basis ratio scales it predictably. This is an estimate;
 * calorie labels remain approximate seed data and this function deliberately
 * does not force macro-calorie arithmetic to equal those labels. Pan and
 * deep-fry presets do not add assumed oil: only entered oil is added once.
 */
export function calculateFoodNutrition(
  food: FoodItem,
  portionMode: PortionMode,
  cookingMethod: CookingMethod,
  oilAddition?: Pick<OilAddition, 'oilType' | 'amount' | 'unit'>,
  servings = 1,
): CalculatedFoodNutrition {
  const validServings = validateServings(servings);
  const baseCalories = portionMode === 'cooked' ? food.caloriesCooked : food.caloriesRaw;
  assertFiniteNumber(baseCalories, 'Food calories', { min: 0, max: 10000, allowZero: true });
  const macroBasis: MacroBasis = food.macroBasis ?? 'cooked';
  const macroBasisCalories = macroBasis === 'raw' ? food.caloriesRaw : food.caloriesCooked;
  const macroBasisRatio = macroBasisCalories > 0 ? baseCalories / macroBasisCalories : 1;
  const base = {
    calories: baseCalories,
    proteinGrams: food.proteinGrams * macroBasisRatio,
    carbGrams: food.carbGrams * macroBasisRatio,
    fatGrams: food.fatGrams * macroBasisRatio,
  };
  const option = food.cookingOptions.find((candidate) => candidate.method === cookingMethod)
    ?? food.cookingOptions.find((candidate) => candidate.method === 'raw')
    ?? { method: cookingMethod, prepTimeMinutes: 0, cookTimeMinutes: 0, macroMultiplier: { calories: 1, protein: 1, carbs: 1, fat: 1 } };
  const multiplier = requiresOilInput(cookingMethod)
    ? { calories: 1, protein: 1, carbs: 1, fat: 1 }
    : option.macroMultiplier;
  const cooked = {
    calories: base.calories * multiplier.calories,
    proteinGrams: base.proteinGrams * multiplier.protein,
    carbGrams: base.carbGrams * multiplier.carbs,
    fatGrams: base.fatGrams * multiplier.fat,
  };
  const finalOil = oilAddition
    ? { ...oilAddition, ...calculateAddedOilCalories(oilAddition.oilType, oilAddition.amount, oilAddition.unit) }
    : undefined;
  return {
    calories: Math.round((cooked.calories + (finalOil?.addedCalories ?? 0)) * validServings),
    proteinGrams: roundOne(cooked.proteinGrams * validServings),
    carbGrams: roundOne(cooked.carbGrams * validServings),
    fatGrams: roundOne((cooked.fatGrams + (finalOil?.addedFatGrams ?? 0)) * validServings),
    portionMode,
    cookingMethod,
    servings: validServings,
    oilAddition: finalOil,
    macroBasis,
    macroScale: macroBasisRatio,
  };
}

// ============================================================
// UNIT CONVERSION HELPERS (imperial input <-> metric engine math)
// ============================================================

const CM_PER_INCH = 2.54;
const KG_PER_LB = 0.45359237;

/** Convert feet + inches to total centimeters for use in BMR/TDEE math. */
export function feetInchesToCm(feet: number, inches: number): number {
  return (feet * 12 + inches) * CM_PER_INCH;
}

/** Convert total centimeters back to whole feet + inches for display. */
export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = cm / CM_PER_INCH;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches - feet * 12);
  return inches === 12 ? { feet: feet + 1, inches: 0 } : { feet, inches };
}

/** Convert pounds to kilograms for use in BMR/TDEE math. */
export function lbsToKg(lbs: number): number {
  return lbs * KG_PER_LB;
}

/** Convert kilograms back to pounds for display. */
export function kgToLbs(kg: number): number {
  return kg / KG_PER_LB;
}

export interface ExerciseLog {
  id: string;
  activityName: string;
  durationMinutes: number;
  caloriesBurned: number;
  timestamp: string; // ISO 8601 timestamp
  /** Local calendar date captured at log time; legacy logs fall back to timestamp. */
  dateKey?: DateKey;
}

export interface DailyEnergyTracker {
  date: string; // ISO date (YYYY-MM-DD)
  targetCalorieGoal: number;
  totalConsumedCalories: number;
  exerciseLogs: ExerciseLog[];
}

// ============================================================
// 2. METABOLIC CALCULATION ENGINE
// ============================================================

export interface MacroTargets {
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
}

const GOAL_ADJUSTMENTS: Record<Goal, number> = {
  fat_loss: -0.2,
  maintenance: 0,
  muscle_gain: 0.1,
};

const MACRO_CALORIE_SPLIT = {
  protein: 0.3,
  carbs: 0.4,
  fats: 0.3,
};

const CALORIES_PER_GRAM = {
  protein: 4,
  carbs: 4,
  fat: 9,
};

/**
 * Calculate Basal Metabolic Rate using the Mifflin-St Jeor equation.
 */
export function calculateBMR(profile: Pick<UserProfile, 'currentWeightKg' | 'heightCm' | 'age' | 'gender'>): number {
  const { currentWeightKg, heightCm, age, gender } = profile;
  const base = 10 * currentWeightKg + 6.25 * heightCm - 5 * age;
  return gender === 'male' ? base + 5 : base - 161;
}

/**
 * Compute Total Daily Energy Expenditure from BMR and activity level.
 */
export function calculateTDEE(bmr: number, activityLevel: number): number {
  return bmr * activityLevel;
}

/**
 * Adjust TDEE according to the user's goal (fat loss deficit, maintenance, or muscle gain surplus).
 */
export function calculateTargetCalories(tdee: number, goal: Goal): number {
  return tdee * (1 + GOAL_ADJUSTMENTS[goal]);
}

/**
 * Calculate daily target macros (Protein 30% / Carbs 40% / Fats 30% of target calories).
 */
export function calculateMacroTargets(targetCalories: number): MacroTargets {
  return {
    proteinGrams: (targetCalories * MACRO_CALORIE_SPLIT.protein) / CALORIES_PER_GRAM.protein,
    carbGrams: (targetCalories * MACRO_CALORIE_SPLIT.carbs) / CALORIES_PER_GRAM.carbs,
    fatGrams: (targetCalories * MACRO_CALORIE_SPLIT.fats) / CALORIES_PER_GRAM.fat,
  };
}

export interface MetabolicSummary {
  bmr: number;
  tdee: number;
  targetCalories: number;
  macroTargets: MacroTargets;
}

/**
 * Convenience function that runs the full metabolic calculation pipeline for a user profile.
 */
export function calculateMetabolicSummary(profile: UserProfile): MetabolicSummary {
  const bmr = calculateBMR(profile);
  const tdee = calculateTDEE(bmr, profile.activityLevel);
  const targetCalories = calculateTargetCalories(tdee, profile.goal);
  const macroTargets = calculateMacroTargets(targetCalories);
  return { bmr, tdee, targetCalories, macroTargets };
}

// ============================================================
// 3. MEAL SPLIT & RAW/COOKED CALORIE CALCULATOR
// ============================================================

const MEAL_SPLIT_RATIOS: Record<MealWindow, number> = {
  breakfast: 0.25,
  lunch: 0.35,
  dinner: 0.35,
  snacks: 0.05,
};

export type MealCalorieSplit = Record<MealWindow, number>;

/**
 * Split daily target calories across meal windows (breakfast/lunch/dinner/snacks).
 */
export function splitCaloriesAcrossMeals(targetCalories: number): MealCalorieSplit {
  return {
    breakfast: targetCalories * MEAL_SPLIT_RATIOS.breakfast,
    lunch: targetCalories * MEAL_SPLIT_RATIOS.lunch,
    dinner: targetCalories * MEAL_SPLIT_RATIOS.dinner,
    snacks: targetCalories * MEAL_SPLIT_RATIOS.snacks,
  };
}

/**
 * Filter a food catalog down to snack items matching the user's chosen snack cravings.
 */
export function filterSnacksByCravings(foods: FoodItem[], cravings: SnackCraving[]): FoodItem[] {
  if (!cravings.length) return [];
  return foods.filter((food) => food.snackProfile.some((profile) => cravings.includes(profile)));
}

export interface RawVsCookedComparison {
  name: string;
  portionRaw: string;
  caloriesRaw: number;
  portionCooked: string;
  caloriesCooked: number;
  /** caloriesCooked - caloriesRaw */
  calorieDelta: number;
}

/**
 * Return raw vs. cooked calories/portion side-by-side for a single food item.
 */
export function compareRawAndCookedCalories(food: FoodItem): RawVsCookedComparison {
  return {
    name: food.name,
    portionRaw: food.portionRaw,
    caloriesRaw: food.caloriesRaw,
    portionCooked: food.portionCooked,
    caloriesCooked: food.caloriesCooked,
    calorieDelta: food.caloriesCooked - food.caloriesRaw,
  };
}

/**
 * Return raw vs. cooked calorie comparisons for every food item assigned to a meal window.
 */
export function compareRawAndCookedCaloriesForMeal(foods: FoodItem[]): RawVsCookedComparison[] {
  return foods.map(compareRawAndCookedCalories);
}

// ============================================================
// 4. LIVE ENERGY BALANCE TRACKER
// ============================================================

/**
 * Sum calories burned across a set of exercise logs.
 */
export function sumExerciseCaloriesBurned(exerciseLogs: ExerciseLog[]): number {
  return exerciseLogs.reduce((total, log) => total + log.caloriesBurned, 0);
}

/**
 * Compute real-time Net Calories Remaining:
 * (Target Daily Calorie Goal + Total Exercise Calories Burned) - Total Consumed Calories.
 */
export function calculateNetCaloriesRemaining(tracker: DailyEnergyTracker): number {
  const totalExerciseCalories = sumExerciseCaloriesBurned(tracker.exerciseLogs);
  return tracker.targetCalorieGoal + totalExerciseCalories - tracker.totalConsumedCalories;
}

export interface EnergyBalanceSnapshot {
  targetCalorieGoal: number;
  totalConsumedCalories: number;
  totalExerciseCaloriesBurned: number;
  netCaloriesRemaining: number;
}

/**
 * Produce a full snapshot of the day's energy balance, useful for dashboard display.
 */
export function getEnergyBalanceSnapshot(tracker: DailyEnergyTracker): EnergyBalanceSnapshot {
  const totalExerciseCaloriesBurned = sumExerciseCaloriesBurned(tracker.exerciseLogs);
  return {
    targetCalorieGoal: tracker.targetCalorieGoal,
    totalConsumedCalories: tracker.totalConsumedCalories,
    totalExerciseCaloriesBurned,
    netCaloriesRemaining: calculateNetCaloriesRemaining(tracker),
  };
}

// ============================================================
// 5. GROCERY COST ESTIMATOR
// ============================================================

export interface GroceryCostEstimate {
  store: StoreName;
  dailyCost: number;
  weeklyCost: number;
}

/**
 * Calculate total estimated daily (and weekly) grocery cost for a list of food items,
 * based on the user's preferred store.
 */
export function estimateGroceryCost(foods: FoodItem[], preferredStore: StoreName): GroceryCostEstimate {
  const dailyCost = foods.reduce((total, food) => total + food.estimatedPrices[preferredStore], 0);
  return {
    store: preferredStore,
    dailyCost,
    weeklyCost: dailyCost * 7,
  };
}

/**
 * Calculate estimated grocery cost at every supported store, for easy price comparison.
 */
export function estimateGroceryCostByAllStores(foods: FoodItem[]): Record<StoreName, GroceryCostEstimate> {
  const stores: StoreName[] = [
    'walmart',
    'kroger',
    'albertsons',
    'aldi',
    'costco',
    'wholeFoods',
    'traderJoes',
    'target',
    'samsClub',
    'publix',
  ];
  return stores.reduce((acc, store) => {
    acc[store] = estimateGroceryCost(foods, store);
    return acc;
  }, {} as Record<StoreName, GroceryCostEstimate>);
}

// ============================================================
// 6. DIETARY SAFEGUARDS, ALLERGY & GI ENGINE
// ============================================================

type DietaryProfile = Pick<UserProfile, 'majorAllergens' | 'giConditions' | 'spiceLevel' | 'customExclusions'>;

const SPICE_LEVEL_RANK: Record<SpiceLevel, number> = { none: 0, mild: 1, medium: 2, spicy: 3 };

/** Structural descriptor accepted for catalog foods, nutrition items, manual entries, and recipes. */
export interface DietaryDescriptor {
  name: string;
  ingredients?: string[];
  allergens?: Allergen[];
  /** Backward-compatible singular/label-style allergen metadata. */
  allergen?: Allergen | Allergen[];
  dietaryTags?: DietaryTags | string[];
  dietaryFlags?: Partial<DietaryTags>;
  flags?: Partial<DietaryTags>;
}

export interface DietaryEvaluation {
  hardBlocked: boolean;
  hardBlockReasons: string[];
  warnings: DietaryWarning[];
  /** Unknown custom/manual ingredients are never presented as certified safe. */
  verification: 'verified' | 'unverified';
}

function dietaryFacts(descriptor: DietaryDescriptor): Partial<DietaryTags> | undefined {
  if (descriptor.dietaryTags && !Array.isArray(descriptor.dietaryTags)) return descriptor.dietaryTags;
  return descriptor.dietaryFlags ?? descriptor.flags;
}

function descriptorText(descriptor: DietaryDescriptor): string {
  return [descriptor.name, ...(descriptor.ingredients ?? [])].join(' ').toLowerCase();
}

/**
 * Evaluate known facts before a recommendation, swap, plan, grocery request, or
 * log mutation. Allergens and explicit custom exclusions are hard blocks; GI and
 * spice conditions stay warnings. Missing facts are explicitly unverified.
 */
export function evaluateDietarySafety(descriptor: DietaryDescriptor, profile: DietaryProfile): DietaryEvaluation {
  const facts = dietaryFacts(descriptor);
  const aliasAllergens = descriptor.allergen === undefined
    ? []
    : Array.isArray(descriptor.allergen) ? descriptor.allergen : [descriptor.allergen];
  const knownAllergens = facts?.allergens ?? descriptor.allergens ?? aliasAllergens;
  const haystack = descriptorText(descriptor);
  const hardBlockReasons: string[] = [];
  const warnings: DietaryWarning[] = [];
  const matchedAllergens = profile.majorAllergens.filter((allergen) => knownAllergens.includes(allergen));
  if (matchedAllergens.length) {
    hardBlockReasons.push(`Contains allergen: ${matchedAllergens.join(', ')}`);
    warnings.push({ label: `Contains ${matchedAllergens.join(', ')} - Allergen`, severity: 'red' });
  }
  for (const exclusion of profile.customExclusions) {
    const normalized = exclusion.trim().toLowerCase();
    if (normalized && haystack.includes(normalized)) {
      hardBlockReasons.push(`Contains excluded ingredient: ${exclusion.trim()}`);
      warnings.push({ label: `Contains excluded ingredient: ${exclusion.trim()}`, severity: 'red' });
    }
  }
  if (profile.giConditions.includes('lactose_intolerance') && facts?.containsLactose) {
    warnings.push({ label: 'Contains Dairy - Lactose Trigger', severity: 'amber' });
  }
  if (profile.giConditions.includes('gluten_sensitivity') && facts?.containsGluten) {
    warnings.push({ label: 'Contains Gluten - Sensitivity Trigger', severity: 'amber' });
  }
  if (profile.giConditions.includes('low_fodmap_ibs') && facts?.isHighFodmap) {
    warnings.push({ label: 'High FODMAP - IBS Trigger', severity: 'amber' });
  }
  if ((profile.giConditions.includes('acid_reflux_gerd') || profile.giConditions.includes('sensitive_stomach')) && facts?.isGerdTrigger) {
    warnings.push({ label: 'GERD/Sensitive Stomach Trigger', severity: 'amber' });
  }
  if (facts?.spiceLevel && SPICE_LEVEL_RANK[facts.spiceLevel] > SPICE_LEVEL_RANK[profile.spiceLevel]) {
    warnings.push({ label: `High Spice (${facts.spiceLevel}) - Exceeds Your Preference`, severity: 'amber' });
  }
  const uniqueWarnings = warnings.filter((warning, index, source) => source.findIndex((item) => item.label === warning.label) === index);
  return {
    hardBlocked: hardBlockReasons.length > 0,
    hardBlockReasons: [...new Set(hardBlockReasons)],
    warnings: uniqueWarnings,
    verification: facts || descriptor.allergens || descriptor.allergen || descriptor.ingredients ? 'verified' : 'unverified',
  };
}

/**
 * True when a food must be hard-blocked from recommendations: it contains a major allergen
 * or matches one of the user's custom blacklisted ingredients.
 */
export function isFoodBlockedForProfile(food: FoodItem, profile: DietaryProfile): boolean {
  return evaluateDietarySafety(food, profile).hardBlocked;
}

/** Filter blacklisted foods (allergens + custom exclusions) out of a list of recommendations. */
export function filterFoodsForProfile<T extends FoodItem>(foods: T[], profile: DietaryProfile): T[] {
  return foods.filter((food) => !isFoodBlockedForProfile(food, profile));
}

export interface DietaryWarning {
  label: string;
  severity: 'amber' | 'red';
}

/**
 * Build the set of warning badges to display for a food, based on the user's allergens,
 * GI conditions, spice tolerance, and custom exclusions. Includes allergen/exclusion matches
 * so already-logged or scanned items still surface a warning even if not pre-filtered.
 */
export function getDietaryWarnings(food: FoodItem, profile: DietaryProfile): DietaryWarning[] {
  return evaluateDietarySafety(food, profile).warnings;
}

// ============================================================
// 7. EATING-OUT & FLEXIBLE MACRO ADJUSTMENT ENGINE
// ============================================================

export interface SmoothAdjustmentPlan {
  /** Total calories consumed beyond the daily target for the triggering meal */
  excessCalories: number;
  /** Number of upcoming days the overage is spread across */
  daysToSpread: number;
  /** Calories to trim from the daily target on each of those days */
  dailyOffset: number;
  /** First effective local day; plans always begin after the triggering day. */
  startDateKey?: DateKey;
  /** Last effective local day, inclusive. */
  endDateKey?: DateKey;
  /** Audit timestamp for a newly created schedule. */
  createdAt?: string;
}

/**
 * Instead of slashing tomorrow's calories by the full overage, spread an eating-out
 * overshoot evenly across the next few days for a gentler adjustment.
 */
export function calculateSmoothAdjustment(excessCalories: number, daysToSpread = 3, today: DateKey = localDateKey()): SmoothAdjustmentPlan {
  assertFiniteNumber(excessCalories, 'Restaurant excess calories', { min: 0, max: 10000, allowZero: true });
  assertFiniteNumber(daysToSpread, 'Days to spread', { min: 1, max: 14 });
  if (!Number.isInteger(daysToSpread)) throw new Error('Days to spread must be a whole number.');
  if (!isDateKey(today)) throw new Error('Adjustment start date must be a valid local date key.');
  const clampedDays = daysToSpread;
  const startDateKey = addDays(today, 1);
  return {
    excessCalories: Math.round(excessCalories),
    daysToSpread: clampedDays,
    dailyOffset: Math.round(excessCalories / clampedDays),
    startDateKey,
    endDateKey: addDays(startDateKey, clampedDays - 1),
    createdAt: new Date().toISOString(),
  };
}

/**
 * Returns the scheduled reduction for one local date. Undated legacy schedules
 * are read safely but inactive, preventing an old offset from lowering targets
 * indefinitely. Supplying a base target clamps the reduction so targets cannot
 * become negative.
 */
export function getAdjustmentForDate(
  plan: SmoothAdjustmentPlan | null | undefined,
  dateKey: DateKey,
  baseTargetCalories?: number,
): number {
  if (!plan || !isDateKey(dateKey) || !isDateKey(plan.startDateKey) || !isDateKey(plan.endDateKey)) return 0;
  if (dateKey < plan.startDateKey || dateKey > plan.endDateKey) return 0;
  const offset = Number.isFinite(plan.dailyOffset) && plan.dailyOffset > 0 ? plan.dailyOffset : 0;
  if (baseTargetCalories === undefined || !Number.isFinite(baseTargetCalories)) return offset;
  return Math.min(offset, Math.max(0, baseTargetCalories));
}
