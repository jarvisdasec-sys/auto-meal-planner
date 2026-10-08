// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadMyFoods, saveMyFoods } from './myFoodsStorage';

const fixture = {
  id: 'custom-fixture', name: 'Fixture Food', category: 'snacks' as const, isSupplement: false,
  servingSize: { amount: 1, unit: 'serving' as const }, calories: 0, proteinGrams: 0, carbGrams: 0, fatGrams: 0,
  dietaryTags: [], ingredients: ['oats'], imageUrl: 'https://images.unsplash.com/photo-fixture',
};

afterEach(() => { window.localStorage.clear(); vi.restoreAllMocks(); });

describe('My Foods storage repair', () => {
  it('retains valid zero-calorie records and filters malformed or unsafe records on read', () => {
    window.localStorage.setItem('btb-meal-planner:my-foods', JSON.stringify([fixture, { id: 'bad', name: '', calories: -1 }]));
    expect(loadMyFoods()).toEqual([fixture]);
  });

  it('validates before writing and catches a storage failure without claiming a save', () => {
    expect(saveMyFoods([fixture])).toBe(true);
    expect(loadMyFoods()).toEqual([fixture]);
    expect(saveMyFoods([{ ...fixture, calories: -1 }])).toBe(false);
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => { throw new DOMException('quota'); });
    expect(saveMyFoods([fixture])).toBe(false);
  });
});
