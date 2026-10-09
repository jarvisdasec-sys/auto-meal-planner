import { create } from 'zustand';
import { isDateKey, type DateKey } from '@/lib/dateKeys';
import {
  RECIPE_DIET_PREFERENCES,
  RECIPE_MEALS,
  RECIPE_MEAL_BY_ID,
  RECIPE_MEAL_WINDOWS,
  RECIPE_TIME_OPTIONS,
  createRecipeWeekPlan,
  reconcileRecipeWeekPlan,
  safeRecipeCandidates,
  type RecipeDietPreference,
  type RecipeTimePreference,
  type RecipeWeekPlan,
  type RecipeWeekPreferences,
  type RecipeWeekSlot,
} from '@/lib/recipeMeals';
import type { MealWindow, UserProfile } from '@/lib/fitnessMealPlanner';

export const RECIPE_WEEK_STORAGE_KEY = 'btb-meal-planner:recipe-week:v1';

export interface SavedRecipeWeek {
  id: string;
  name: string;
  plan: RecipeWeekPlan;
  lockedSlots: string[];
  savedAt: string;
}

interface PersistedRecipeWeekState {
  plan: RecipeWeekPlan | null;
  favorites: string[];
  savedWeeks: SavedRecipeWeek[];
  lockedSlots: string[];
  purchased: Record<string, string[]>;
  prepCompleted: Record<string, string[]>;
  householdSize: number;
}

export interface RecipeWeekState extends PersistedRecipeWeekState {
  hasHydrated: boolean;
  storageAvailable: boolean;
  generateRecipeWeek: (profile: UserProfile, preferences: RecipeWeekPreferences) => void;
  regenerateUnlocked: (profile: UserProfile) => void;
  swapRecipe: (profile: UserProfile, day: number, mealWindow: MealWindow, recipeId: string) => void;
  setRecipeServings: (day: number, mealWindow: MealWindow, servings: number) => void;
  toggleLock: (day: number, mealWindow: MealWindow) => void;
  toggleFavorite: (recipeId: string) => void;
  saveWeek: (name: string) => void;
  loadWeek: (savedWeekId: string, profile: UserProfile) => void;
  setHouseholdSize: (householdSize: number) => void;
  togglePurchased: (scope: string, ingredientId: string) => void;
  togglePrep: (scope: string, recipeId: string) => void;
}

const MEAL_WINDOW_SET = new Set<MealWindow>(RECIPE_MEAL_WINDOWS);
const DIET_SET = new Set<RecipeDietPreference>(RECIPE_DIET_PREFERENCES);
const TIME_SET = new Set<number>(RECIPE_TIME_OPTIONS);

function newId(prefix: string): string {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

function now(): string { return new Date().toISOString(); }
function slotKey(day: number, mealWindow: MealWindow): string { return `${day}:${mealWindow}`; }

function safeServings(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 100 ? value : null;
}

function safePreferences(value: unknown): RecipeWeekPreferences | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<RecipeWeekPreferences>;
  if (!isDateKey(candidate.startDateKey) || !DIET_SET.has(candidate.diet as RecipeDietPreference) || !TIME_SET.has(candidate.maxTotalMinutes as number)) return null;
  return { startDateKey: candidate.startDateKey, diet: candidate.diet as RecipeDietPreference, maxTotalMinutes: candidate.maxTotalMinutes as RecipeTimePreference };
}

function safeSlot(value: unknown): RecipeWeekSlot | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<RecipeWeekSlot>;
  const servings = safeServings(candidate.servings);
  if (!Number.isInteger(candidate.day) || (candidate.day as number) < 1 || (candidate.day as number) > 7 || !MEAL_WINDOW_SET.has(candidate.mealWindow as MealWindow) || typeof candidate.recipeId !== 'string' || !RECIPE_MEAL_BY_ID[candidate.recipeId] || servings === null) return null;
  return { day: candidate.day as number, mealWindow: candidate.mealWindow as MealWindow, recipeId: candidate.recipeId, servings };
}

function safePlan(value: unknown): RecipeWeekPlan | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<RecipeWeekPlan>;
  const preferences = safePreferences(candidate.preferences);
  if (typeof candidate.id !== 'string' || !candidate.id.trim() || !isDateKey(candidate.startDateKey) || !preferences || !Array.isArray(candidate.slots)) return null;
  const uniqueSlots = new Map<string, RecipeWeekSlot>();
  candidate.slots.slice(0, 28).forEach((entry) => {
    const slot = safeSlot(entry);
    if (slot) uniqueSlots.set(slotKey(slot.day, slot.mealWindow), slot);
  });
  return {
    id: candidate.id.slice(0, 160), startDateKey: candidate.startDateKey, preferences: { ...preferences, startDateKey: candidate.startDateKey }, slots: [...uniqueSlots.values()],
    createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt.slice(0, 80) : '', updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt.slice(0, 80) : '',
  };
}

function safeRecipeIds(value: unknown, max = RECIPE_MEALS.length): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === 'string' && Boolean(RECIPE_MEAL_BY_ID[item])))].slice(0, max);
}

function safeLocks(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === 'string' && /^([1-7]):(breakfast|lunch|dinner|snacks)$/.test(item)))].slice(0, 28);
}

function safeChecklistMap(value: unknown): Record<string, string[]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.entries(value).slice(-60).reduce<Record<string, string[]>>((result, [scope, entries]) => {
    if (typeof scope !== 'string' || scope.length > 500 || !Array.isArray(entries)) return result;
    result[scope] = [...new Set(entries.filter((entry): entry is string => typeof entry === 'string' && entry.length <= 160))].slice(0, 200);
    return result;
  }, {});
}

function safeHousehold(value: unknown): number { return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 20 ? value : 1; }

function safeSavedWeeks(value: unknown): SavedRecipeWeek[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-20).flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const candidate = entry as Partial<SavedRecipeWeek>;
    const plan = safePlan(candidate.plan);
    if (!plan || typeof candidate.id !== 'string' || !candidate.id.trim() || typeof candidate.name !== 'string' || !candidate.name.trim()) return [];
    return [{ id: candidate.id.slice(0, 160), name: candidate.name.trim().slice(0, 80), plan, lockedSlots: safeLocks(candidate.lockedSlots), savedAt: typeof candidate.savedAt === 'string' ? candidate.savedAt.slice(0, 80) : '' }];
  });
}

function validHousehold(householdSize: number): number {
  if (!Number.isInteger(householdSize) || householdSize < 1 || householdSize > 20) throw new Error('Household size must be a whole number from 1 to 20.');
  return householdSize;
}

function updatedPlan(plan: RecipeWeekPlan, slots: RecipeWeekSlot[]): RecipeWeekPlan {
  return { ...plan, slots, updatedAt: now() };
}

let hydrationComplete = false;

export const useRecipeWeekStore = create<RecipeWeekState>((set, get) => ({
  plan: null,
  favorites: [],
  savedWeeks: [],
  lockedSlots: [],
  purchased: {},
  prepCompleted: {},
  householdSize: 1,
  hasHydrated: false,
  storageAvailable: true,

  generateRecipeWeek: (profile, preferences) => {
    const safe = safePreferences(preferences);
    if (!safe) throw new Error('Choose a valid start date, diet preference, and time preference.');
    const generated = createRecipeWeekPlan(profile, safe, { id: newId('recipe-week') });
    set({ plan: generated, lockedSlots: [] });
  },

  regenerateUnlocked: (profile) => {
    const current = get().plan;
    if (!current) throw new Error('Generate a recipe week first.');
    const locks = new Set(get().lockedSlots);
    const lockedSlots = current.slots.filter((slot) => locks.has(slotKey(slot.day, slot.mealWindow)));
    const regenerated = createRecipeWeekPlan(profile, current.preferences, {
      id: current.id, existingSlots: lockedSlots, preserveExisting: true, seed: Date.now(), now: current.createdAt || now(),
    });
    set({ plan: { ...regenerated, createdAt: current.createdAt || regenerated.createdAt, updatedAt: now() }, lockedSlots: get().lockedSlots.filter((key) => lockedSlots.some((prior) => slotKey(prior.day, prior.mealWindow) === key && regenerated.slots.some((slot) => slotKey(slot.day, slot.mealWindow) === key && slot.recipeId === prior.recipeId))) });
  },

  swapRecipe: (profile, day, mealWindow, recipeId) => {
    const current = get().plan;
    if (!current) throw new Error('Generate a recipe week before swapping a meal.');
    if (!Number.isInteger(day) || day < 1 || day > 7 || !MEAL_WINDOW_SET.has(mealWindow)) throw new Error('Choose a valid day and meal window.');
    const candidates = safeRecipeCandidates(profile, current.preferences, mealWindow);
    if (!candidates.some((candidate) => candidate.id === recipeId)) throw new Error('That recipe is unavailable with your current dietary and time safeguards.');
    const prior = current.slots.find((slot) => slot.day === day && slot.mealWindow === mealWindow);
    const slots = [...current.slots.filter((slot) => slot.day !== day || slot.mealWindow !== mealWindow), { day, mealWindow, recipeId, servings: prior?.servings ?? 1 }];
    set({ plan: updatedPlan(current, slots) });
  },

  setRecipeServings: (day, mealWindow, servings) => {
    const current = get().plan;
    const safe = safeServings(servings);
    if (!current) throw new Error('Generate a recipe week before changing servings.');
    if (!Number.isInteger(day) || day < 1 || day > 7 || !MEAL_WINDOW_SET.has(mealWindow) || safe === null) throw new Error('Choose a valid meal and a positive serving amount.');
    const existing = current.slots.find((slot) => slot.day === day && slot.mealWindow === mealWindow);
    if (!existing) throw new Error('There is no safe recipe selected for that meal.');
    set({ plan: updatedPlan(current, current.slots.map((slot) => slot.day === day && slot.mealWindow === mealWindow ? { ...slot, servings: safe } : slot)) });
  },

  toggleLock: (day, mealWindow) => {
    if (!Number.isInteger(day) || day < 1 || day > 7 || !MEAL_WINDOW_SET.has(mealWindow)) throw new Error('Choose a valid day and meal window.');
    const key = slotKey(day, mealWindow);
    set((state) => ({ lockedSlots: state.lockedSlots.includes(key) ? state.lockedSlots.filter((entry) => entry !== key) : [...state.lockedSlots, key] }));
  },

  toggleFavorite: (recipeId) => {
    if (!RECIPE_MEAL_BY_ID[recipeId]) throw new Error('Only recipes in this catalog can be favorited.');
    set((state) => ({ favorites: state.favorites.includes(recipeId) ? state.favorites.filter((entry) => entry !== recipeId) : [...state.favorites, recipeId] }));
  },

  saveWeek: (name) => {
    const current = get().plan;
    const safeName = name.trim().replace(/\s+/g, ' ').slice(0, 80);
    if (!current) throw new Error('Generate a recipe week before saving it.');
    if (!safeName) throw new Error('Give this recipe week a name before saving.');
    const saved: SavedRecipeWeek = { id: newId('saved-recipe-week'), name: safeName, plan: current, lockedSlots: get().lockedSlots, savedAt: now() };
    set((state) => {
      const existing = state.savedWeeks.find((week) => week.name.toLowerCase() === safeName.toLowerCase());
      return { savedWeeks: existing ? state.savedWeeks.map((week) => week.id === existing.id ? { ...saved, id: existing.id } : week) : [...state.savedWeeks, saved].slice(-20) };
    });
  },

  loadWeek: (savedWeekId, profile) => {
    const saved = get().savedWeeks.find((week) => week.id === savedWeekId);
    if (!saved) throw new Error('That saved recipe week is not available in this browser.');
    const reconciled = reconcileRecipeWeekPlan(saved.plan, profile);
    const available = new Set(reconciled.slots.filter((slot) => saved.plan.slots.some((prior) => slotKey(prior.day, prior.mealWindow) === slotKey(slot.day, slot.mealWindow) && prior.recipeId === slot.recipeId)).map((slot) => slotKey(slot.day, slot.mealWindow)));
    set({ plan: { ...reconciled, updatedAt: now() }, lockedSlots: saved.lockedSlots.filter((key) => available.has(key)) });
  },

  setHouseholdSize: (householdSize) => set({ householdSize: validHousehold(householdSize) }),
  togglePurchased: (scope, ingredientId) => {
    if (!scope || scope.length > 500 || !RECIPE_MEAL_BY_ID[ingredientId] && !RECIPE_MEALS.some((recipe) => recipe.ingredients.some((ingredient) => ingredient.ingredientId === ingredientId))) throw new Error('Choose a valid shopping item.');
    set((state) => {
      const current = state.purchased[scope] ?? [];
      return { purchased: { ...state.purchased, [scope]: current.includes(ingredientId) ? current.filter((item) => item !== ingredientId) : [...current, ingredientId] } };
    });
  },
  togglePrep: (scope, recipeId) => {
    if (!scope || scope.length > 500 || !RECIPE_MEAL_BY_ID[recipeId]) throw new Error('Choose a valid preparation task.');
    set((state) => {
      const current = state.prepCompleted[scope] ?? [];
      return { prepCompleted: { ...state.prepCompleted, [scope]: current.includes(recipeId) ? current.filter((item) => item !== recipeId) : [...current, recipeId] } };
    });
  },
}));

/** Explicit effect-only hydration keeps SSR and first client render identical. */
export function hydrateRecipeWeekStore(): boolean {
  if (hydrationComplete || typeof window === 'undefined') return false;
  let persisted: Partial<PersistedRecipeWeekState> = {};
  let storageAvailable = true;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(RECIPE_WEEK_STORAGE_KEY);
  } catch { storageAvailable = false; }
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') persisted = parsed as Partial<PersistedRecipeWeekState>;
    } catch { /* A corrupt snapshot is not proof that browser storage is unavailable. */ }
  }
  const plan = safePlan(persisted.plan);
  useRecipeWeekStore.setState({
    plan, favorites: safeRecipeIds(persisted.favorites), savedWeeks: safeSavedWeeks(persisted.savedWeeks), lockedSlots: safeLocks(persisted.lockedSlots).filter((key) => !plan || plan.slots.some((slot) => slotKey(slot.day, slot.mealWindow) === key)),
    purchased: safeChecklistMap(persisted.purchased), prepCompleted: safeChecklistMap(persisted.prepCompleted), householdSize: safeHousehold(persisted.householdSize), hasHydrated: true, storageAvailable,
  });
  hydrationComplete = true;
  return true;
}

useRecipeWeekStore.subscribe((state) => {
  if (!hydrationComplete || typeof window === 'undefined') return;
  const snapshot: PersistedRecipeWeekState = {
    plan: state.plan, favorites: state.favorites, savedWeeks: state.savedWeeks, lockedSlots: state.lockedSlots, purchased: state.purchased, prepCompleted: state.prepCompleted, householdSize: state.householdSize,
  };
  try { window.localStorage.setItem(RECIPE_WEEK_STORAGE_KEY, JSON.stringify(snapshot)); }
  catch { if (state.storageAvailable) useRecipeWeekStore.setState({ storageAvailable: false }); }
});
