// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('workspace persistence boundaries', () => {
  beforeEach(() => { vi.resetModules(); localStorage.clear(); });
  it('does not overwrite existing workspace before hydration and preserves valid session data', async () => {
    const { useWorkspaceStore, hydrateWorkspaceStore, WORKSPACE_STORAGE_KEY } = await import('./useWorkspaceStore');
    const saved = { householdSize: 3, weeklyBudget: 175, prepSessions: { 'plan-fixture': { date: '2026-10-09', notes: 'Fixture note', completed: ['shop'] } }, purchased: { 'plan-fixture': ['grilled-chicken'] } };
    localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(saved));
    useWorkspaceStore.getState().updatePreferences(2, 100);
    expect(JSON.parse(localStorage.getItem(WORKSPACE_STORAGE_KEY)!)).toEqual(saved);
    hydrateWorkspaceStore();
    expect(useWorkspaceStore.getState()).toMatchObject(saved);
    useWorkspaceStore.getState().togglePrep('plan-fixture', 'chill');
    expect(JSON.parse(localStorage.getItem(WORKSPACE_STORAGE_KEY)!).prepSessions['plan-fixture'].completed).toEqual(['shop', 'chill']);
  });
  it('rejects invalid preferences and safely hydrates malformed values', async () => {
    const { useWorkspaceStore, hydrateWorkspaceStore, WORKSPACE_STORAGE_KEY } = await import('./useWorkspaceStore');
    localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify({ householdSize: 999, weeklyBudget: -25, prepSessions: { bad: { date: 'not-a-date' } }, purchased: { bad: 12 } }));
    hydrateWorkspaceStore();
    expect(useWorkspaceStore.getState()).toMatchObject({ householdSize: 1, weeklyBudget: 100, prepSessions: {}, purchased: {} });
    expect(() => useWorkspaceStore.getState().updatePreferences(2, Number.NaN)).toThrow('budget');
    expect(() => useWorkspaceStore.getState().updatePrep('plan', { date: '' })).toThrow('valid');
  });
  it('isolates purchased and prep marks by plan key', async () => {
    const { useWorkspaceStore } = await import('./useWorkspaceStore');
    useWorkspaceStore.getState().togglePurchased('first', 'food');
    useWorkspaceStore.getState().togglePrep('second', 'shop');
    expect(useWorkspaceStore.getState().purchased.first).toEqual(['food']);
    expect(useWorkspaceStore.getState().purchased.second).toBeUndefined();
    expect(useWorkspaceStore.getState().prepSessions.first).toBeUndefined();
  });
});
