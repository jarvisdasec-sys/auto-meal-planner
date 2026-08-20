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
  snackProfile: SnackCraving[];
  /** Estimated price (per portion/unit) at each supported store */
  estimatedPrices: EstimatedPrices;
  /** High-quality food photo; UI falls back to a default category image when absent */
  imageUrl?: string;
  /** Available cooking methods with their macro/time impact */
  cookingOptions: CookingOption[];
  /** Allergen, FODMAP, GERD-trigger, and spice metadata used by the dietary safeguards engine */
  dietaryTags: DietaryTags;
}

export interface DietaryTags {
  allergens: Allergen[];
  isHighFodmap: boolean;
  isGerdTrigger: boolean;
  containsGluten: boolean;
  containsLactose: boolean;
  spiceLevel: SpiceLevel;
}

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

/**
 * True when a food must be hard-blocked from recommendations: it contains a major allergen
 * or matches one of the user's custom blacklisted ingredients.
 */
export function isFoodBlockedForProfile(food: FoodItem, profile: DietaryProfile): boolean {
  if (profile.majorAllergens.some((allergen) => food.dietaryTags.allergens.includes(allergen))) return true;
  const lowerName = food.name.toLowerCase();
  if (profile.customExclusions.some((term) => term.trim() && lowerName.includes(term.trim().toLowerCase()))) {
    return true;
  }
  return false;
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
  const warnings: DietaryWarning[] = [];
  const tags = food.dietaryTags;

  const matchedAllergens = profile.majorAllergens.filter((allergen) => tags.allergens.includes(allergen));
  if (matchedAllergens.length > 0) {
    warnings.push({
      label: `⚠️ Contains ${matchedAllergens.join(', ')} - Allergen`,
      severity: 'red',
    });
  }

  const lowerName = food.name.toLowerCase();
  const matchedExclusion = profile.customExclusions.find(
    (term) => term.trim() && lowerName.includes(term.trim().toLowerCase()),
  );
  if (matchedExclusion) {
    warnings.push({ label: `⚠️ Contains excluded ingredient: ${matchedExclusion}`, severity: 'red' });
  }

  if (profile.giConditions.includes('lactose_intolerance') && tags.containsLactose) {
    warnings.push({ label: '⚠️ Contains Dairy - Lactose Trigger', severity: 'amber' });
  }
  if (profile.giConditions.includes('gluten_sensitivity') && tags.containsGluten) {
    warnings.push({ label: '⚠️ Contains Gluten - Sensitivity Trigger', severity: 'amber' });
  }
  if (profile.giConditions.includes('low_fodmap_ibs') && tags.isHighFodmap) {
    warnings.push({ label: '⚠️ High FODMAP - IBS Trigger', severity: 'amber' });
  }
  if ((profile.giConditions.includes('acid_reflux_gerd') || profile.giConditions.includes('sensitive_stomach')) && tags.isGerdTrigger) {
    warnings.push({ label: '🌶️ GERD/Sensitive Stomach Trigger', severity: 'amber' });
  }
  if (SPICE_LEVEL_RANK[tags.spiceLevel] > SPICE_LEVEL_RANK[profile.spiceLevel]) {
    warnings.push({ label: `🌶️ High Spice (${tags.spiceLevel}) - Exceeds Your Preference`, severity: 'amber' });
  }

  return warnings;
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
}

/**
 * Instead of slashing tomorrow's calories by the full overage, spread an eating-out
 * overshoot evenly across the next few days for a gentler adjustment.
 */
export function calculateSmoothAdjustment(excessCalories: number, daysToSpread = 3): SmoothAdjustmentPlan {
  const clampedDays = Math.max(1, Math.round(daysToSpread));
  return {
    excessCalories: Math.round(excessCalories),
    daysToSpread: clampedDays,
    dailyOffset: Math.round(excessCalories / clampedDays),
  };
}
