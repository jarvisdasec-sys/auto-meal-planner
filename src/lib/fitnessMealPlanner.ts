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

export type StoreName = 'walmart' | 'foodLion' | 'aldi' | 'kroger';

export type MealWindow = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

export interface UserProfile {
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
}

export interface EstimatedPrices {
  walmart: number;
  foodLion: number;
  aldi: number;
  kroger: number;
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
  const stores: StoreName[] = ['walmart', 'foodLion', 'aldi', 'kroger'];
  return stores.reduce((acc, store) => {
    acc[store] = estimateGroceryCost(foods, store);
    return acc;
  }, {} as Record<StoreName, GroceryCostEstimate>);
}
