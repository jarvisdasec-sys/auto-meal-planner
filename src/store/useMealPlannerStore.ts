import { create } from 'zustand';
import type { UserProfile, ExerciseLog, SnackCraving, Goal, Gender, StoreName } from '../lib/fitnessMealPlanner';
import { FOOD_CATALOG, type CatalogFoodItem } from '../lib/foodCatalog';

export interface LoggedFoodEntry {
  id: string;
  foodId: string;
  name: string;
  calories: number;
  portionMode: 'raw' | 'cooked';
  timestamp: string;
}

const DEFAULT_PROFILE: UserProfile = {
  heightCm: 175,
  currentWeightKg: 80,
  age: 30,
  gender: 'male',
  activityLevel: 1.55,
  goal: 'fat_loss',
  snackCravings: ['salty'],
  dietaryRestrictions: [],
  preferredStore: 'walmart',
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

  addExerciseLog: (log: Omit<ExerciseLog, 'id' | 'timestamp'>) => void;
  removeExerciseLog: (id: string) => void;

  logFood: (foodId: string, name: string, calories: number, portionMode: 'raw' | 'cooked') => void;
  removeLoggedFood: (id: string) => void;

  addCustomFood: (food: CatalogFoodItem) => void;

  totalConsumedCalories: () => number;
}

export const useMealPlannerStore = create<MealPlannerState>((set, get) => ({
  profile: DEFAULT_PROFILE,
  foodCatalog: FOOD_CATALOG,
  exerciseLogs: [],
  loggedFoods: [],

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

  addExerciseLog: (log) =>
    set((state) => ({
      exerciseLogs: [
        ...state.exerciseLogs,
        { ...log, id: crypto.randomUUID(), timestamp: new Date().toISOString() },
      ],
    })),
  removeExerciseLog: (id) =>
    set((state) => ({ exerciseLogs: state.exerciseLogs.filter((log) => log.id !== id) })),

  logFood: (foodId, name, calories, portionMode) =>
    set((state) => ({
      loggedFoods: [
        ...state.loggedFoods,
        { id: crypto.randomUUID(), foodId, name, calories, portionMode, timestamp: new Date().toISOString() },
      ],
    })),
  removeLoggedFood: (id) =>
    set((state) => ({ loggedFoods: state.loggedFoods.filter((entry) => entry.id !== id) })),

  addCustomFood: (food) =>
    set((state) => ({
      foodCatalog: state.foodCatalog.some((existing) => existing.id === food.id)
        ? state.foodCatalog
        : [...state.foodCatalog, food],
    })),

  totalConsumedCalories: () => get().loggedFoods.reduce((total, entry) => total + entry.calories, 0),
}));
