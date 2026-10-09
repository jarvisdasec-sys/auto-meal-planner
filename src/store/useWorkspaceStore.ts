import { create } from 'zustand';
import { isDateKey, localDateKey } from '@/lib/dateKeys';
import { validateHouseholdSize } from '@/lib/premiumPlanner';

export const WORKSPACE_STORAGE_KEY = 'btb-meal-planner:workspace:v1';
export interface PrepSession { date: string; notes: string; completed: string[] }
interface WorkspaceState {
  householdSize: number;
  weeklyBudget: number;
  prepSessions: Record<string, PrepSession>;
  purchased: Record<string, string[]>;
  hasHydrated: boolean;
  storageAvailable: boolean;
  updatePreferences: (householdSize: number, weeklyBudget: number) => void;
  updatePrep: (key: string, changes: Partial<PrepSession>) => void;
  togglePrep: (key: string, task: string) => void;
  togglePurchased: (key: string, foodId: string) => void;
}
export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  householdSize: 1, weeklyBudget: 100, prepSessions: {}, purchased: {}, hasHydrated: false, storageAvailable: true,
  updatePreferences: (householdSize, weeklyBudget) => {
    validateHouseholdSize(householdSize);
    if (!Number.isFinite(weeklyBudget) || weeklyBudget < 0 || weeklyBudget > 10000) throw new Error('Weekly budget must be between $0 and $10,000.');
    set({ householdSize, weeklyBudget });
  },
  updatePrep: (key, changes) => set((state) => {
    if (changes.date !== undefined && !isDateKey(changes.date)) throw new Error('Choose a valid preparation date.');
    const current = state.prepSessions[key] ?? { date: localDateKey(), notes: '', completed: [] };
    return { prepSessions: { ...state.prepSessions, [key]: { ...current, ...changes, notes: (changes.notes ?? current.notes).slice(0, 5000) } } };
  }),
  togglePrep: (key, task) => set((state) => {
    const current = state.prepSessions[key] ?? { date: localDateKey(), notes: '', completed: [] };
    const completed = current.completed.includes(task) ? current.completed.filter((id) => id !== task) : [...current.completed, task];
    return { prepSessions: { ...state.prepSessions, [key]: { ...current, completed } } };
  }),
  togglePurchased: (key, foodId) => set((state) => {
    const current = state.purchased[key] ?? [];
    return { purchased: { ...state.purchased, [key]: current.includes(foodId) ? current.filter((id) => id !== foodId) : [...current, foodId] } };
  }),
}));

let hydrated = false;
export function hydrateWorkspaceStore() {
  if (hydrated || typeof window === 'undefined') return;
  let values: Partial<WorkspaceState> = {};
  let storageAvailable = true;
  try {
    const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (raw) values = JSON.parse(raw);
    if (!values || typeof values !== 'object') values = {};
  } catch { storageAvailable = false; }
  let householdSize = 1;
  try { householdSize = validateHouseholdSize(values.householdSize ?? 1); } catch { /* Keep valid default. */ }
  const prepSessions: Record<string, PrepSession> = {};
  if (values.prepSessions && typeof values.prepSessions === 'object') {
    Object.entries(values.prepSessions).slice(-60).forEach(([key, session]) => {
      if (session && isDateKey(session.date)) prepSessions[key] = { date: session.date, notes: typeof session.notes === 'string' ? session.notes.slice(0, 5000) : '', completed: Array.isArray(session.completed) ? session.completed.filter((v) => typeof v === 'string') : [] };
    });
  }
  const purchased: Record<string, string[]> = {};
  if (values.purchased && typeof values.purchased === 'object') Object.entries(values.purchased).slice(-60).forEach(([key, items]) => { if (Array.isArray(items)) purchased[key] = items.filter((id) => typeof id === 'string'); });
  useWorkspaceStore.setState({ householdSize, weeklyBudget: typeof values.weeklyBudget === 'number' && Number.isFinite(values.weeklyBudget) && values.weeklyBudget >= 0 && values.weeklyBudget <= 10000 ? values.weeklyBudget : 100, prepSessions, purchased, hasHydrated: true, storageAvailable });
  hydrated = true;
}

useWorkspaceStore.subscribe((state) => {
  if (!hydrated || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify({ householdSize: state.householdSize, weeklyBudget: state.weeklyBudget, prepSessions: Object.fromEntries(Object.entries(state.prepSessions).slice(-60)), purchased: Object.fromEntries(Object.entries(state.purchased).slice(-60)) }));
  } catch { if (state.storageAvailable) useWorkspaceStore.setState({ storageAvailable: false }); }
});
