import { create } from 'zustand';
import {
  calculateFoodNutrition,
  evaluateDietarySafety,
  type Allergen,
  type CookingMethod,
  type DietaryTags,
  type ExerciseLog,
  type Gender,
  type GICondition,
  type Goal,
  type MealWindow,
  type MacroBasis,
  type OilAddition,
  type OilType,
  type SmoothAdjustmentPlan,
  type SnackCraving,
  type SpiceLevel,
  type StoreName,
  type UserProfile,
} from '../lib/fitnessMealPlanner';
import { FOOD_CATALOG, type CatalogFoodItem } from '../lib/foodCatalog';
import { addDays, isDateKey, localDateKey, type DateKey } from '../lib/dateKeys';
import {
  calculateDailyNutritionTotals,
  getExerciseEntriesForDate,
  getFoodEntriesForDate,
  getHydrationEntriesForDate,
  type DailyNutritionTotals,
} from '../lib/nutritionLedger';
import {
  assertFiniteNumber,
  assertRequiredName,
  validateExercise,
  validateHydrationOunces,
  validateNutrition,
  validateProfile,
  validateServings,
} from '../lib/mealPlannerValidation';
import type { PantryStock, PantryStockEntry, WeeklyMealSlot } from '../lib/pantryPlanner';
import {
  createWeeklyPlan,
  resolveActiveWeeklyPlan,
  type PersistedWeeklyPlan,
} from '../lib/weeklyPlan';

export interface LoggedFoodMetadata {
  servings?: number;
  /** Optional display portion text retained with the final nutrition snapshot. */
  portion?: string;
  imageUrl?: string;
  ingredients?: string[];
  allergens?: Allergen[];
  dietaryFlags?: Partial<DietaryTags>;
  /** Original source label (catalog, manual, restaurant, barcode, recipe, etc.). */
  source?: string;
  /** Allows a caller to pass manual nutrition per serving without breaking old final-total calls. */
  nutritionIsPerServing?: boolean;
  /** Explicit date for history edits or selected-day logging. */
  dateKey?: DateKey;
}

export interface LoggedFoodEntry {
  id: string;
  foodId: string;
  name: string;
  calories: number;
  portionMode: 'raw' | 'cooked';
  cookingMethod: CookingMethod;
  oilAddition?: OilAddition;
  mealType?: MealWindow;
  proteinGrams?: number;
  carbGrams?: number;
  fatGrams?: number;
  /** Provenance for catalog macro estimates; manual values are caller supplied. */
  macroBasis?: MacroBasis | 'manual';
  macroScale?: number;
  servings?: number;
  portion?: string;
  imageUrl?: string;
  ingredients?: string[];
  allergens?: Allergen[];
  dietaryFlags?: Partial<DietaryTags>;
  dietaryWarnings?: string[];
  dietaryVerification?: 'verified' | 'unverified';
  source?: string;
  /** Stable local-calendar key; legacy entries safely derive it from timestamp. */
  dateKey?: DateKey;
  timestamp: string;
}

export interface HydrationEntry {
  id: string;
  ounces: number;
  dateKey?: DateKey;
  timestamp: string;
}

export interface SavedRecipe {
  id: string;
  foodId?: string;
  name: string;
  calories: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
  mealWindow?: MealWindow;
  ingredients?: string[];
  instructions?: string[];
  servings?: number;
  imageUrl?: string;
  portionMode?: 'raw' | 'cooked';
  cookingMethod?: CookingMethod;
  oilAddition?: OilAddition;
  allergens?: Allergen[];
  dietaryFlags?: Partial<DietaryTags>;
}

export const DEFAULT_PROFILE: UserProfile = {
  fullName: 'Alex Johnson',
  heightCm: 175,
  currentWeightKg: 80,
  age: 30,
  gender: 'male',
  activityLevel: 1.55,
  goal: 'fat_loss',
  snackCravings: ['salty'],
  dietaryRestrictions: [],
  preferredStore: 'walmart',
  majorAllergens: [],
  giConditions: [],
  spiceLevel: 'medium',
  customExclusions: [],
};

export const MEAL_PLANNER_STORAGE_KEY = 'auto-meal-planner:state:v1';

type PersistedState = Partial<Pick<
  MealPlannerState,
  | 'profile'
  | 'foodCatalog'
  | 'exerciseLogs'
  | 'loggedFoods'
  | 'hydrationLogs'
  | 'savedRecipes'
  | 'weeklyPlan'
  | 'pantryStock'
  | 'calorieAdjustmentPlan'
>>;

export interface MealPlannerState {
  profile: UserProfile;
  foodCatalog: CatalogFoodItem[];
  exerciseLogs: ExerciseLog[];
  loggedFoods: LoggedFoodEntry[];
  hydrationLogs: HydrationEntry[];
  savedRecipes: SavedRecipe[];
  weeklyPlan: PersistedWeeklyPlan | null;
  pantryStock: PantryStock;
  calorieAdjustmentPlan: SmoothAdjustmentPlan | null;
  /** False on SSR and the first client render, then true after explicit client hydration. */
  hasHydrated: boolean;

  updateProfile: (partial: Partial<UserProfile>) => void;
  setGender: (gender: Gender) => void;
  setGoal: (goal: Goal) => void;
  setPreferredStore: (store: StoreName) => void;
  toggleSnackCraving: (craving: SnackCraving) => void;
  toggleAllergen: (allergen: Allergen) => void;
  toggleGICondition: (condition: GICondition) => void;
  setSpiceLevel: (level: SpiceLevel) => void;
  setCustomExclusions: (exclusions: string[]) => void;

  addExerciseLog: (log: Omit<ExerciseLog, 'id' | 'timestamp'>) => void;
  updateExerciseLog: (id: string, changes: Partial<Omit<ExerciseLog, 'id' | 'timestamp'>>) => void;
  removeExerciseLog: (id: string) => void;

  logFood: (
    foodId: string,
    name: string,
    calories: number,
    portionMode: 'raw' | 'cooked',
    cookingMethod: CookingMethod,
    oilAddition?: OilAddition,
    mealType?: MealWindow,
    macros?: { proteinGrams: number; carbGrams: number; fatGrams: number },
    metadata?: LoggedFoodMetadata,
  ) => void;
  removeLoggedFood: (id: string) => void;
  updateLoggedFood: (id: string, changes: Partial<Omit<LoggedFoodEntry, 'id' | 'timestamp'>>) => void;
  updateLoggedFoodCooking: (
    id: string,
    cookingMethod: CookingMethod,
    oilType: OilType,
    oilAmount: number,
    oilUnit: 'tbsp' | 'tsp',
  ) => void;

  addCustomFood: (food: CatalogFoodItem) => void;

  addHydration: (ounces: number, dateKey?: DateKey) => void;
  updateHydration: (id: string, changes: Partial<Omit<HydrationEntry, 'id' | 'timestamp'>>) => void;
  removeHydration: (id: string) => void;

  addSavedRecipe: (recipe: SavedRecipe) => void;
  removeSavedRecipe: (id: string) => void;

  generateWeeklyPlan: (options?: { startDateKey?: DateKey; seed?: number }) => void;
  regenerateWeeklyPlan: (options?: { startDateKey?: DateKey; seed?: number }) => void;
  substituteWeeklyPlanSlot: (day: number, mealWindow: MealWindow, foodId: string, servings?: number) => void;
  copyWeeklyPlanDay: (sourceDay: number, targetDay: number) => void;
  clearWeeklyPlan: () => void;
  setPantryStock: (foodId: string, stock: PantryStockEntry) => void;
  clearPantryStock: (foodId: string) => void;

  setCalorieAdjustmentPlan: (plan: SmoothAdjustmentPlan) => void;
  clearCalorieAdjustmentPlan: () => void;

  totalConsumedCalories: (dateKey?: DateKey) => number;
  getDailyNutritionTotals: (dateKey?: DateKey) => DailyNutritionTotals;
  getFoodsForDate: (dateKey: DateKey) => LoggedFoodEntry[];
  getExerciseForDate: (dateKey: DateKey) => ExerciseLog[];
  getHydrationForDate: (dateKey: DateKey) => HydrationEntry[];
}

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getInitialFoodCatalog(persistedCatalog?: CatalogFoodItem[]): CatalogFoodItem[] {
  if (!persistedCatalog?.length) return FOOD_CATALOG;
  const builtInIds = new Set(FOOD_CATALOG.map((food) => food.id));
  // Built-ins always come from the shipped catalog; only retained user-created ids are appended.
  return [...FOOD_CATALOG, ...persistedCatalog.filter((food) => food && !builtInIds.has(food.id))];
}

function safeProfile(profile: unknown): UserProfile {
  try {
    return validateProfile({ ...DEFAULT_PROFILE, ...(profile && typeof profile === 'object' ? profile : {}) }, DEFAULT_PROFILE);
  } catch {
    return DEFAULT_PROFILE;
  }
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function safePantryStock(value: unknown): PantryStock {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.entries(value as Record<string, unknown>).reduce<PantryStock>((result, [foodId, stock]) => {
    if (!stock || typeof stock !== 'object') return result;
    const candidate = stock as PantryStockEntry;
    if (typeof candidate.portions !== 'number' || !Number.isFinite(candidate.portions) || candidate.portions < 0) return result;
    result[foodId] = { portions: candidate.portions, ...(isDateKey(candidate.expiresOn) ? { expiresOn: candidate.expiresOn } : {}) };
    return result;
  }, {});
}

function safePersist(state: MealPlannerState): void {
  if (!hydrationComplete || typeof window === 'undefined') return;
  const snapshot: PersistedState = {
    profile: state.profile,
    foodCatalog: state.foodCatalog,
    exerciseLogs: state.exerciseLogs,
    loggedFoods: state.loggedFoods,
    hydrationLogs: state.hydrationLogs,
    savedRecipes: state.savedRecipes,
    weeklyPlan: state.weeklyPlan,
    pantryStock: state.pantryStock,
    calorieAdjustmentPlan: state.calorieAdjustmentPlan,
  };
  try {
    window.localStorage.setItem(MEAL_PLANNER_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Security/quota failures must not break an in-memory user action.
  }
}

let hydrationComplete = false;

export const useMealPlannerStore = create<MealPlannerState>((set, get) => ({
  profile: DEFAULT_PROFILE,
  foodCatalog: FOOD_CATALOG,
  exerciseLogs: [],
  loggedFoods: [],
  hydrationLogs: [],
  savedRecipes: [],
  weeklyPlan: null,
  pantryStock: {},
  calorieAdjustmentPlan: null,
  hasHydrated: false,

  updateProfile: (partial) => set((state) => ({ profile: validateProfile({ ...state.profile, ...partial }, DEFAULT_PROFILE) })),
  setGender: (gender) => get().updateProfile({ gender }),
  setGoal: (goal) => get().updateProfile({ goal }),
  setPreferredStore: (preferredStore) => get().updateProfile({ preferredStore }),
  toggleSnackCraving: (craving) => set((state) => {
    const snackCravings = state.profile.snackCravings.includes(craving)
      ? state.profile.snackCravings.filter((item) => item !== craving)
      : [...state.profile.snackCravings, craving];
    return { profile: validateProfile({ ...state.profile, snackCravings }, DEFAULT_PROFILE) };
  }),
  toggleAllergen: (allergen) => set((state) => {
    const majorAllergens = state.profile.majorAllergens.includes(allergen)
      ? state.profile.majorAllergens.filter((item) => item !== allergen)
      : [...state.profile.majorAllergens, allergen];
    return { profile: validateProfile({ ...state.profile, majorAllergens }, DEFAULT_PROFILE) };
  }),
  toggleGICondition: (condition) => set((state) => {
    const giConditions = state.profile.giConditions.includes(condition)
      ? state.profile.giConditions.filter((item) => item !== condition)
      : [...state.profile.giConditions, condition];
    return { profile: validateProfile({ ...state.profile, giConditions }, DEFAULT_PROFILE) };
  }),
  setSpiceLevel: (spiceLevel) => get().updateProfile({ spiceLevel }),
  setCustomExclusions: (customExclusions) => get().updateProfile({ customExclusions }),

  addExerciseLog: (log) => set((state) => {
    const validated = validateExercise(log);
    const dateKey = log.dateKey && isDateKey(log.dateKey) ? log.dateKey : localDateKey();
    return { exerciseLogs: [...state.exerciseLogs, { ...validated, id: createId(), timestamp: new Date().toISOString(), dateKey }] };
  }),
  updateExerciseLog: (id, changes) => set((state) => ({
    exerciseLogs: state.exerciseLogs.map((entry) => {
      if (entry.id !== id) return entry;
      const validated = validateExercise({
        activityName: changes.activityName ?? entry.activityName,
        durationMinutes: changes.durationMinutes ?? entry.durationMinutes,
        caloriesBurned: changes.caloriesBurned ?? entry.caloriesBurned,
      });
      if (changes.dateKey !== undefined && !isDateKey(changes.dateKey)) throw new Error('Exercise date must be a valid local calendar date.');
      return { ...entry, ...validated, ...(changes.dateKey ? { dateKey: changes.dateKey } : {}) };
    }),
  })),
  removeExerciseLog: (id) => set((state) => ({ exerciseLogs: state.exerciseLogs.filter((entry) => entry.id !== id) })),

  logFood: (foodId, name, calories, portionMode, cookingMethod, oilAddition, mealType, macros, metadata = {}) => set((state) => {
    const safeName = assertRequiredName(name, 'Food name');
    if (portionMode !== 'raw' && portionMode !== 'cooked') throw new Error('Portion mode must be raw or cooked.');
    if (metadata.dateKey !== undefined && !isDateKey(metadata.dateKey)) throw new Error('Food date must be a valid local calendar date.');
    const food = state.foodCatalog.find((item) => item.id === foodId);
    const dietary = evaluateDietarySafety(food ?? {
      name: safeName,
      ingredients: metadata.ingredients,
      allergens: metadata.allergens,
      dietaryFlags: metadata.dietaryFlags,
    }, state.profile);
    if (dietary.hardBlocked) throw new Error(`Food cannot be logged: ${dietary.hardBlockReasons.join('; ')}.`);
    const servings = metadata.servings === undefined ? 1 : validateServings(metadata.servings);
    const snapshot = food
      ? calculateFoodNutrition(food, portionMode, cookingMethod, oilAddition, servings)
      : (() => {
          const base = validateNutrition({
            calories,
            proteinGrams: macros?.proteinGrams ?? 0,
            carbGrams: macros?.carbGrams ?? 0,
            fatGrams: macros?.fatGrams ?? 0,
          });
          const multiplier = metadata.nutritionIsPerServing ? servings : 1;
          return {
            calories: Math.round(base.calories * multiplier),
            proteinGrams: base.proteinGrams * multiplier,
            carbGrams: base.carbGrams * multiplier,
            fatGrams: base.fatGrams * multiplier,
            oilAddition,
            macroBasis: 'manual' as const,
            macroScale: 1,
          };
        })();
    const dateKey = metadata.dateKey ?? localDateKey();
    const entry: LoggedFoodEntry = {
      id: createId(),
      foodId,
      name: safeName,
      calories: snapshot.calories,
      portionMode,
      cookingMethod,
      oilAddition: snapshot.oilAddition,
      mealType,
      proteinGrams: snapshot.proteinGrams,
      carbGrams: snapshot.carbGrams,
      fatGrams: snapshot.fatGrams,
      macroBasis: snapshot.macroBasis,
      macroScale: snapshot.macroScale,
      servings,
      portion: metadata.portion ?? (food ? (portionMode === 'raw' ? food.portionRaw : food.portionCooked) : undefined),
      imageUrl: metadata.imageUrl ?? food?.imageUrl,
      ingredients: metadata.ingredients ?? food?.ingredients,
      allergens: metadata.allergens ?? food?.dietaryTags.allergens,
      dietaryFlags: metadata.dietaryFlags ?? food?.dietaryTags,
      dietaryWarnings: dietary.warnings.map((warning) => warning.label),
      dietaryVerification: dietary.verification,
      source: metadata.source,
      dateKey,
      timestamp: new Date().toISOString(),
    };
    return { loggedFoods: [...state.loggedFoods, entry] };
  }),
  removeLoggedFood: (id) => set((state) => ({ loggedFoods: state.loggedFoods.filter((entry) => entry.id !== id) })),
  updateLoggedFood: (id, changes) => set((state) => ({
    loggedFoods: state.loggedFoods.map((entry) => {
      if (entry.id !== id) return entry;
      if (changes.dateKey !== undefined && !isDateKey(changes.dateKey)) throw new Error('Food date must be a valid local calendar date.');
      const candidate = { ...entry, ...changes, id: entry.id, timestamp: entry.timestamp };
      const safeName = assertRequiredName(candidate.name, 'Food name');
      const food = state.foodCatalog.find((item) => item.id === candidate.foodId);
      if (food && (changes.cookingMethod || changes.portionMode || changes.oilAddition || changes.servings !== undefined)) {
        const calculated = calculateFoodNutrition(
          food,
          candidate.portionMode,
          candidate.cookingMethod,
          candidate.oilAddition,
          candidate.servings ?? 1,
        );
        return { ...candidate, name: safeName, ...calculated };
      }
      const nutrition = validateNutrition({
        calories: candidate.calories,
        proteinGrams: candidate.proteinGrams ?? 0,
        carbGrams: candidate.carbGrams ?? 0,
        fatGrams: candidate.fatGrams ?? 0,
      });
      if (candidate.servings !== undefined) validateServings(candidate.servings);
      return { ...candidate, name: safeName, ...nutrition };
    }),
  })),
  updateLoggedFoodCooking: (id, cookingMethod, oilType, oilAmount, oilUnit) => set((state) => ({
    loggedFoods: state.loggedFoods.map((entry) => {
      if (entry.id !== id) return entry;
      const food = state.foodCatalog.find((item) => item.id === entry.foodId);
      if (!food) return { ...entry, cookingMethod };
      const calculated = calculateFoodNutrition(
        food,
        entry.portionMode,
        cookingMethod,
        { oilType, amount: oilAmount, unit: oilUnit },
        entry.servings ?? 1,
      );
      return { ...entry, ...calculated, portion: entry.portion ?? (entry.portionMode === 'raw' ? food.portionRaw : food.portionCooked) };
    }),
  })),

  addCustomFood: (food) => set((state) => {
    assertRequiredName(food.name, 'Food name');
    validateNutrition({ calories: food.caloriesRaw, proteinGrams: food.proteinGrams, carbGrams: food.carbGrams, fatGrams: food.fatGrams });
    assertFiniteNumber(food.caloriesCooked, 'Cooked calories', { min: 0, max: 10000, allowZero: true });
    return { foodCatalog: state.foodCatalog.some((existing) => existing.id === food.id) ? state.foodCatalog : [...state.foodCatalog, food] };
  }),

  addHydration: (ounces, dateKey = localDateKey()) => set((state) => {
    const validDate = isDateKey(dateKey) ? dateKey : (() => { throw new Error('Hydration date must be a valid local calendar date.'); })();
    return { hydrationLogs: [...state.hydrationLogs, { id: createId(), ounces: validateHydrationOunces(ounces), dateKey: validDate, timestamp: new Date().toISOString() }] };
  }),
  updateHydration: (id, changes) => set((state) => ({
    hydrationLogs: state.hydrationLogs.map((entry) => {
      if (entry.id !== id) return entry;
      if (changes.dateKey !== undefined && !isDateKey(changes.dateKey)) throw new Error('Hydration date must be a valid local calendar date.');
      return { ...entry, ounces: validateHydrationOunces(changes.ounces ?? entry.ounces), ...(changes.dateKey ? { dateKey: changes.dateKey } : {}) };
    }),
  })),
  removeHydration: (id) => set((state) => ({ hydrationLogs: state.hydrationLogs.filter((entry) => entry.id !== id) })),

  addSavedRecipe: (recipe) => set((state) => {
    assertRequiredName(recipe.name, 'Recipe name');
    validateNutrition(recipe);
    if (recipe.servings !== undefined) validateServings(recipe.servings);
    return { savedRecipes: state.savedRecipes.some((existing) => existing.id === recipe.id) ? state.savedRecipes : [...state.savedRecipes, recipe] };
  }),
  removeSavedRecipe: (id) => set((state) => ({ savedRecipes: state.savedRecipes.filter((recipe) => recipe.id !== id) })),

  generateWeeklyPlan: (options) => set((state) => ({ weeklyPlan: createWeeklyPlan(state.foodCatalog, state.profile, options) })),
  regenerateWeeklyPlan: (options) => set((state) => ({
    weeklyPlan: createWeeklyPlan(state.foodCatalog, state.profile, {
      startDateKey: options?.startDateKey ?? state.weeklyPlan?.startDateKey,
      seed: options?.seed,
    }),
  })),
  substituteWeeklyPlanSlot: (day, mealWindow, foodId, servings = 1) => set((state) => {
    if (!Number.isInteger(day) || day < 1 || day > 7) throw new Error('Plan day must be between 1 and 7.');
    const selected = state.foodCatalog.find((food) => food.id === foodId);
    if (!selected || !selected.mealWindows.includes(mealWindow)) throw new Error('Selected food is not available for this meal window.');
    const dietary = evaluateDietarySafety(selected, state.profile);
    if (dietary.hardBlocked) throw new Error(`Selected food is excluded: ${dietary.hardBlockReasons.join('; ')}.`);
    const plan = state.weeklyPlan ?? createWeeklyPlan(state.foodCatalog, state.profile);
    const slot = { day, mealWindow, foodId, servings: validateServings(servings) };
    return { weeklyPlan: { ...plan, slots: [...plan.slots.filter((item) => item.day !== day || item.mealWindow !== mealWindow), slot] } };
  }),
  copyWeeklyPlanDay: (sourceDay, targetDay) => set((state) => {
    if (![sourceDay, targetDay].every((day) => Number.isInteger(day) && day >= 1 && day <= 7)) throw new Error('Plan days must be between 1 and 7.');
    if (sourceDay === targetDay) throw new Error('Choose two different plan days.');
    if (!state.weeklyPlan) throw new Error('Generate a weekly plan first.');
    const source = resolveActiveWeeklyPlan(state.weeklyPlan, state.foodCatalog, state.profile).filter((slot) => slot.day === sourceDay);
    if (!source.length) throw new Error('The source day has no allowed meals to copy.');
    return { weeklyPlan: { ...state.weeklyPlan, slots: [...state.weeklyPlan.slots.filter((slot) => slot.day !== targetDay), ...source.map((slot) => ({ day: targetDay, mealWindow: slot.mealWindow, foodId: slot.food.id, servings: slot.servings ?? 1 }))] } };
  }),
  clearWeeklyPlan: () => set({ weeklyPlan: null }),
  setPantryStock: (foodId, stock) => set((state) => {
    const key = assertRequiredName(foodId, 'Food id');
    const portions = assertFiniteNumber(stock.portions, 'Pantry portions', { min: 0, max: 10000, allowZero: true });
    if (stock.expiresOn !== undefined && !isDateKey(stock.expiresOn)) throw new Error('Pantry expiry must be a valid local calendar date.');
    return { pantryStock: { ...state.pantryStock, [key]: { portions, ...(stock.expiresOn ? { expiresOn: stock.expiresOn } : {}) } } };
  }),
  clearPantryStock: (foodId) => set((state) => {
    const { [foodId]: _removed, ...pantryStock } = state.pantryStock;
    return { pantryStock };
  }),

  setCalorieAdjustmentPlan: (plan) => set(() => {
    const excessCalories = assertFiniteNumber(plan.excessCalories, 'Restaurant excess calories', { min: 0, max: 10000, allowZero: true });
    const daysToSpread = assertFiniteNumber(plan.daysToSpread, 'Days to spread', { min: 1, max: 14 });
    const dailyOffset = assertFiniteNumber(plan.dailyOffset, 'Daily adjustment', { min: 0, max: 10000, allowZero: true });
    if (!Number.isInteger(daysToSpread)) throw new Error('Days to spread must be a whole number.');
    const startDateKey = plan.startDateKey ?? addDays(localDateKey(), 1);
    if (!isDateKey(startDateKey)) throw new Error('Adjustment start date must be a valid local calendar date.');
    const endDateKey = plan.endDateKey ?? addDays(startDateKey, daysToSpread - 1);
    if (!isDateKey(endDateKey) || endDateKey < startDateKey) throw new Error('Adjustment end date must not be before its start date.');
    return { calorieAdjustmentPlan: { ...plan, excessCalories, daysToSpread, dailyOffset, startDateKey, endDateKey, createdAt: plan.createdAt ?? new Date().toISOString() } };
  }),
  clearCalorieAdjustmentPlan: () => set({ calorieAdjustmentPlan: null }),

  totalConsumedCalories: (dateKey = localDateKey()) => calculateDailyNutritionTotals(get().loggedFoods, dateKey, get().foodCatalog).calories,
  getDailyNutritionTotals: (dateKey = localDateKey()) => calculateDailyNutritionTotals(get().loggedFoods, dateKey, get().foodCatalog),
  getFoodsForDate: (dateKey) => getFoodEntriesForDate(get().loggedFoods, dateKey),
  getExerciseForDate: (dateKey) => getExerciseEntriesForDate(get().exerciseLogs, dateKey),
  getHydrationForDate: (dateKey) => getHydrationEntriesForDate(get().hydrationLogs, dateKey),
}));

/**
 * Hydrate only from a client effect. Initial SSR and the first client render share
 * defaults, preventing a localStorage-driven hydration mismatch.
 */
export function hydrateMealPlannerStore(): boolean {
  if (hydrationComplete || typeof window === 'undefined') return false;
  let persisted: PersistedState = {};
  try {
    const raw = window.localStorage.getItem(MEAL_PLANNER_STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') persisted = parsed as PersistedState;
    }
  } catch {
    // Invalid JSON or blocked storage leaves the safe in-memory defaults intact.
  }
  useMealPlannerStore.setState({
    profile: safeProfile(persisted.profile),
    foodCatalog: getInitialFoodCatalog(asArray<CatalogFoodItem>(persisted.foodCatalog)),
    exerciseLogs: asArray<ExerciseLog>(persisted.exerciseLogs),
    loggedFoods: asArray<LoggedFoodEntry>(persisted.loggedFoods),
    hydrationLogs: asArray<HydrationEntry>(persisted.hydrationLogs),
    savedRecipes: asArray<SavedRecipe>(persisted.savedRecipes),
    weeklyPlan: persisted.weeklyPlan ?? null,
    pantryStock: safePantryStock(persisted.pantryStock),
    calorieAdjustmentPlan: persisted.calorieAdjustmentPlan ?? null,
    hasHydrated: true,
  });
  hydrationComplete = true;
  return true;
}

/** Resolve the stored plan for render without returning a new Zustand selector value. */
export function getActiveWeeklyPlan(state: Pick<MealPlannerState, 'weeklyPlan' | 'foodCatalog' | 'profile'>): WeeklyMealSlot[] {
  return resolveActiveWeeklyPlan(state.weeklyPlan, state.foodCatalog, state.profile);
}

useMealPlannerStore.subscribe((state) => safePersist(state));
