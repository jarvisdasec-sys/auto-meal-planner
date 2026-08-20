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
  timestamp: string;
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

interface MealPlannerState {
  profile: UserProfile;
  foodCatalog: CatalogFoodItem[];
  exerciseLogs: ExerciseLog[];
  loggedFoods: LoggedFoodEntry[];

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
  ) => void;
  removeLoggedFood: (id: string) => void;
  updateLoggedFoodCooking: (
    id: string,
    cookingMethod: CookingMethod,
    oilType: OilType,
    oilAmount: number,
    oilUnit: 'tbsp' | 'tsp',
  ) => void;

  addCustomFood: (food: CatalogFoodItem) => void;

  calorieAdjustmentPlan: SmoothAdjustmentPlan | null;
  setCalorieAdjustmentPlan: (plan: SmoothAdjustmentPlan) => void;
  clearCalorieAdjustmentPlan: () => void;

  totalConsumedCalories: () => number;
}

export const useMealPlannerStore = create<MealPlannerState>((set, get) => ({
  profile: DEFAULT_PROFILE,
  foodCatalog: FOOD_CATALOG,
  exerciseLogs: [],
  loggedFoods: [],
  calorieAdjustmentPlan: null,

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

  logFood: (foodId, name, calories, portionMode, cookingMethod, oilAddition) =>
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
          timestamp: new Date().toISOString(),
        },
      ],
    })),
  removeLoggedFood: (id) =>
    set((state) => ({ loggedFoods: state.loggedFoods.filter((entry) => entry.id !== id) })),
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

  setCalorieAdjustmentPlan: (calorieAdjustmentPlan) => set({ calorieAdjustmentPlan }),
  clearCalorieAdjustmentPlan: () => set({ calorieAdjustmentPlan: null }),

  totalConsumedCalories: () => get().loggedFoods.reduce((total, entry) => total + entry.calories, 0),
}));
