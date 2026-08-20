import type { NutritionItem } from '@/types/nutrition';

const STORAGE_KEY = 'btb-meal-planner:my-foods';

/** Load user-created custom foods persisted in localStorage (empty on the server or if unset). */
export function loadMyFoods(): NutritionItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as NutritionItem[]) : [];
  } catch {
    return [];
  }
}

/** Persist the full list of user-created custom foods to localStorage. */
export function saveMyFoods(items: NutritionItem[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}
