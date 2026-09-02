import { create } from 'zustand';
import type {
  UserProfile,
  ExerciseLog,
  SnackCraving,
  Goal,
  Gender,
  StoreName,
  CookingMethod,
  OilAddition,
  OilType,
  Allergen,
  GICondition,
  SpiceLevel,
  SmoothAdjustmentPlan,
  MealWindow,
} from '../lib/fitnessMealPlanner';
import { applyCookingOption, calculateAddedOilCalories, requiresOilInput } from '../lib/fitnessMealPlanner';
import { FOOD_CATALOG, type CatalogFoodItem } from '../lib/foodCatalog';

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
  timestamp: string;
}

export interface HydrationEntry {
  id: string;
  ounces: number;
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
}

const DEFAULT_PROFILE: UserProfile = {
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

const STORAGE_KEY = 'auto-meal-planner:state:v1';

interface MealPlannerState {
  profile: UserProfile;
  foodCatalog: CatalogFoodItem[];
  exerciseLogs: ExerciseLog[];
  loggedFoods: LoggedFoodEntry[];
  hydrationLogs: HydrationEntry[];
  savedRecipes: SavedRecipe[];

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
  ) => void;
  removeLoggedFood: (id: string) => void;
  /** Inline edit of a logged entry (name, calories, macros, meal type, portion label). */
  updateLoggedFood: (id: string, changes: Partial<Omit<LoggedFoodEntry, 'id' | 'timestamp'>>) => void;
  updateLoggedFoodCooking: (
    id: string,
    cookingMethod: CookingMethod,
    oilType: OilType,
    oilAmount: number,
    oilUnit: 'tbsp' | 'tsp',
  ) => void;

  addCustomFood: (food: CatalogFoodItem) => void;

  addHydration: (ounces: number) => void;
  removeHydration: (id: string) => void;

  addSavedRecipe: (recipe: SavedRecipe) => void;
  removeSavedRecipe: (id: string) => void;

  calorieAdjustmentPlan: SmoothAdjustmentPlan | null;
  setCalorieAdjustmentPlan: (plan: SmoothAdjustmentPlan) => void;
  clearCalorieAdjustmentPlan: () => void;

  totalConsumedCalories: () => number;
}

function loadPersistedState(): Partial<Pick<MealPlannerState, 'profile' | 'foodCatalog' | 'exerciseLogs' | 'loggedFoods' | 'hydrationLogs' | 'savedRecipes' | 'calorieAdjustmentPlan'>> {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<Pick<MealPlannerState, 'profile' | 'foodCatalog' | 'exerciseLogs' | 'loggedFoods' | 'hydrationLogs' | 'savedRecipes' | 'calorieAdjustmentPlan'>>;
  } catch {
    return {};
  }
}

function getInitialFoodCatalog(persistedCatalog?: CatalogFoodItem[]) {
  if (!persistedCatalog || persistedCatalog.length === 0) return FOOD_CATALOG;

  const builtInFoodIds = new Set(FOOD_CATALOG.map((food) => food.id));
  const customFoods = persistedCatalog.filter((food) => !builtInFoodIds.has(food.id));

  return [...FOOD_CATALOG, ...customFoods];
}

const persistedState = loadPersistedState();

export const useMealPlannerStore = create<MealPlannerState>((set, get) => ({
  profile: persistedState.profile ?? DEFAULT_PROFILE,
  foodCatalog: getInitialFoodCatalog(persistedState.foodCatalog),
  exerciseLogs: persistedState.exerciseLogs ?? [],
  loggedFoods: persistedState.loggedFoods ?? [],
  hydrationLogs: persistedState.hydrationLogs ?? [],
  savedRecipes: persistedState.savedRecipes ?? [],
  calorieAdjustmentPlan: persistedState.calorieAdjustmentPlan ?? null,

  updateProfile: (partial) => set((state) => ({ profile: { ...state.profile, ...partial } })),
  setGender: (gender) => set((state) => ({ profile: { ...state.profile, gender } })),
  setGoal: (goal) => set((state) => ({ profile: { ...state.profile, goal } })),
  setPreferredStore: (preferredStore) => set((state) => ({ profile: { ...state.profile, preferredStore } })),
  toggleSnackCraving: (craving) =>
    set((state) => {
      const has = state.profile.snackCravings.includes(craving);
      const snackCravings = has
        ? state.profile.snackCravings.filter((c) => c !== craving)
        : [...state.profile.snackCravings, craving];
      return { profile: { ...state.profile, snackCravings } };
    }),
  toggleAllergen: (allergen) =>
    set((state) => {
      const has = state.profile.majorAllergens.includes(allergen);
      const majorAllergens = has
        ? state.profile.majorAllergens.filter((a) => a !== allergen)
        : [...state.profile.majorAllergens, allergen];
      return { profile: { ...state.profile, majorAllergens } };
    }),
  toggleGICondition: (condition) =>
    set((state) => {
      const has = state.profile.giConditions.includes(condition);
      const giConditions = has
        ? state.profile.giConditions.filter((c) => c !== condition)
        : [...state.profile.giConditions, condition];
      return { profile: { ...state.profile, giConditions } };
    }),
  setSpiceLevel: (spiceLevel) => set((state) => ({ profile: { ...state.profile, spiceLevel } })),
  setCustomExclusions: (customExclusions) => set((state) => ({ profile: { ...state.profile, customExclusions } })),

  addExerciseLog: (log) =>
    set((state) => ({
      exerciseLogs: [
        ...state.exerciseLogs,
        { ...log, id: crypto.randomUUID(), timestamp: new Date().toISOString() },
      ],
    })),
  removeExerciseLog: (id) =>
    set((state) => ({ exerciseLogs: state.exerciseLogs.filter((log) => log.id !== id) })),

  logFood: (foodId, name, calories, portionMode, cookingMethod, oilAddition, mealType, macros) =>
    set((state) => ({
      loggedFoods: [
        ...state.loggedFoods,
        {
          id: crypto.randomUUID(),
          foodId,
          name,
          calories,
          portionMode,
          cookingMethod,
          oilAddition,
          mealType,
          proteinGrams: macros?.proteinGrams,
          carbGrams: macros?.carbGrams,
          fatGrams: macros?.fatGrams,
          timestamp: new Date().toISOString(),
        },
      ],
    })),
  removeLoggedFood: (id) =>
    set((state) => ({ loggedFoods: state.loggedFoods.filter((entry) => entry.id !== id) })),
  updateLoggedFood: (id, changes) =>
    set((state) => ({
      loggedFoods: state.loggedFoods.map((entry) => (entry.id === id ? { ...entry, ...changes } : entry)),
    })),
  updateLoggedFoodCooking: (id, cookingMethod, oilType, oilAmount, oilUnit) =>
    set((state) => ({
      loggedFoods: state.loggedFoods.map((entry) => {
        if (entry.id !== id) return entry;
        const food = state.foodCatalog.find((f) => f.id === entry.foodId);
        if (!food) return { ...entry, cookingMethod };

        const option = food.cookingOptions.find((o) => o.method === cookingMethod) ?? food.cookingOptions[0];
        const adjusted = applyCookingOption(
          {
            calories: food.caloriesRaw,
            proteinGrams: food.proteinGrams,
            carbGrams: food.carbGrams,
            fatGrams: food.fatGrams,
          },
          option,
        );
        const oil = requiresOilInput(cookingMethod)
          ? calculateAddedOilCalories(oilType, oilAmount, oilUnit)
          : null;
        const oilAddition: OilAddition | undefined = oil
          ? { oilType, amount: oilAmount, unit: oilUnit, addedCalories: oil.addedCalories, addedFatGrams: oil.addedFatGrams }
          : undefined;

        return {
          ...entry,
          cookingMethod,
          oilAddition,
          calories: Math.round(adjusted.calories + (oil?.addedCalories ?? 0)),
        };
      }),
    })),

  addCustomFood: (food) =>
    set((state) => ({
      foodCatalog: state.foodCatalog.some((existing) => existing.id === food.id)
        ? state.foodCatalog
        : [...state.foodCatalog, food],
    })),

  addHydration: (ounces) =>
    set((state) => ({
      hydrationLogs: [
        ...state.hydrationLogs,
        { id: crypto.randomUUID(), ounces, timestamp: new Date().toISOString() },
      ],
    })),
  removeHydration: (id) =>
    set((state) => ({ hydrationLogs: state.hydrationLogs.filter((entry) => entry.id !== id) })),

  addSavedRecipe: (recipe) =>
    set((state) => ({
      savedRecipes: state.savedRecipes.some((existing) => existing.id === recipe.id)
        ? state.savedRecipes
        : [...state.savedRecipes, recipe],
    })),
  removeSavedRecipe: (id) =>
    set((state) => ({ savedRecipes: state.savedRecipes.filter((recipe) => recipe.id !== id) })),

  setCalorieAdjustmentPlan: (calorieAdjustmentPlan) => set({ calorieAdjustmentPlan }),
  clearCalorieAdjustmentPlan: () => set({ calorieAdjustmentPlan: null }),

  totalConsumedCalories: () => get().loggedFoods.reduce((total, entry) => total + entry.calories, 0),
}));

if (typeof window !== 'undefined') {
  useMealPlannerStore.subscribe((state) => {
    const snapshot = {
      profile: state.profile,
      foodCatalog: state.foodCatalog,
      exerciseLogs: state.exerciseLogs,
      loggedFoods: state.loggedFoods,
      hydrationLogs: state.hydrationLogs,
      savedRecipes: state.savedRecipes,
      calorieAdjustmentPlan: state.calorieAdjustmentPlan,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  });

  const catalog = useMealPlannerStore.getState().foodCatalog;
  fetch('/api/kroger-images', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      foods: catalog.map(({ id, barcode, name }) => ({ id, barcode, name })),
    }),
  })
    .then((response) => (response.ok ? response.json() : null))
    .then((data: { images?: Record<string, string> } | null) => {
      const images = data?.images;
      if (!images || Object.keys(images).length === 0) return;

      useMealPlannerStore.setState((state) => ({
        foodCatalog: state.foodCatalog.map((food) =>
          images[food.id] ? { ...food, imageUrl: images[food.id] } : food,
        ),
      }));
    })
    .catch(() => {
      // Keep existing catalog images when Kroger is unavailable.
    });
}
