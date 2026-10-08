// @vitest-environment happy-dom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { calculateMetabolicSummary, feetInchesToCm, lbsToKg } from '@/lib/fitnessMealPlanner';
import { FOOD_CATALOG } from '@/lib/foodCatalog';
import { DEFAULT_PROFILE, useMealPlannerStore } from '@/store/useMealPlannerStore';

vi.mock('next/image', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  return {
    default: ({ fill: _fill, priority: _priority, ...props }: Record<string, unknown>) => React.createElement('img', props),
  };
});

import ProfileSetupForm from './ProfileSetupForm';

function freshProfile() {
  return {
    ...DEFAULT_PROFILE,
    snackCravings: [...DEFAULT_PROFILE.snackCravings],
    dietaryRestrictions: [...DEFAULT_PROFILE.dietaryRestrictions],
    majorAllergens: [...DEFAULT_PROFILE.majorAllergens],
    giConditions: [...DEFAULT_PROFILE.giConditions],
    customExclusions: [...DEFAULT_PROFILE.customExclusions],
  };
}

function resetStore() {
  useMealPlannerStore.setState({
    profile: freshProfile(),
    foodCatalog: FOOD_CATALOG,
    exerciseLogs: [],
    loggedFoods: [],
    hydrationLogs: [],
    savedRecipes: [],
    weeklyPlan: null,
    pantryStock: {},
    calorieAdjustmentPlan: null,
    hasHydrated: false,
  });
}

function input(container: HTMLElement, label: string): HTMLInputElement {
  const element = container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
  if (!element) throw new Error(`Could not find input ${label}`);
  return element;
}

function select(container: HTMLElement, label: string): HTMLSelectElement {
  const element = container.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`);
  if (!element) throw new Error(`Could not find select ${label}`);
  return element;
}

function button(container: HTMLElement, label: string): HTMLButtonElement {
  const element = Array.from(container.querySelectorAll('button')).find((candidate) => candidate.textContent?.trim() === label);
  if (!element) throw new Error(`Could not find button ${label}`);
  return element;
}

function checkbox(container: HTMLElement, visibleLabel: string): HTMLInputElement {
  const element = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).find((candidate) => (
    candidate.closest('label')?.textContent?.replace(/\s+/g, ' ').trim().toLowerCase().includes(visibleLabel.toLowerCase())
  ));
  if (!element) throw new Error(`Could not find checkbox ${visibleLabel}`);
  return element;
}

async function changeText(element: HTMLInputElement, value: string) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function changeSelect(element: HTMLSelectElement, value: string) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    setter?.call(element, value);
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function click(element: HTMLElement) {
  await act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

describe('ProfileSetupForm repair', () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalUpdateProfile: ReturnType<typeof useMealPlannerStore.getState>['updateProfile'];

  async function mount(key = 'form') {
    await act(async () => {
      root.render(createElement(ProfileSetupForm, { key }));
    });
  }

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    window.localStorage.clear();
    resetStore();
    originalUpdateProfile = useMealPlannerStore.getState().updateProfile;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    useMealPlannerStore.setState({ updateProfile: originalUpdateProfile });
  });

  it.each([
    ['blank', 'Weight (lbs)', '', 'Weight is required.'],
    ['negative', 'Age', '-1', 'Age must be greater than zero.'],
    ['non-finite', 'Weight (lbs)', 'Infinity', 'Weight must be a finite number.'],
    ['out-of-range', 'Height feet', '10', 'Height must be no greater than 250.'],
  ])('does not persist a %s draft and exposes actionable field feedback', async (_kind, label, value, errorText) => {
    const updateSpy = vi.fn((partial: Parameters<typeof originalUpdateProfile>[0]) => originalUpdateProfile(partial));
    useMealPlannerStore.setState({ updateProfile: updateSpy });
    await mount(`invalid-${label}-${value}`);
    const before = freshProfile();
    const bmrBefore = `${Math.round(calculateMetabolicSummary(before).bmr)} kcal`;

    await changeText(input(container, label), value);
    await click(container.querySelector<HTMLButtonElement>('[aria-label="Save profile changes"]')!);

    expect(updateSpy).not.toHaveBeenCalled();
    expect(useMealPlannerStore.getState().profile).toEqual(before);
    expect(input(container, label).getAttribute('aria-invalid')).toBe('true');
    expect(container.querySelector('[role="alert"]')?.textContent).toBe(errorText);
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Unsaved changes.');
    expect(container.textContent).toContain(`BMR${bmrBefore}`);
  });

  it('converts valid imperial drafts, commits the complete candidate once, normalizes the display, and updates summary values', async () => {
    const updateSpy = vi.fn((partial: Parameters<typeof originalUpdateProfile>[0]) => originalUpdateProfile(partial));
    useMealPlannerStore.setState({ updateProfile: updateSpy });
    await mount();

    await changeText(input(container, 'Full Name'), 'Taylor Morgan');
    await changeText(input(container, 'Height feet'), '5');
    await changeText(input(container, 'Height inches'), '14');
    await changeText(input(container, 'Weight (lbs)'), '176');
    await changeText(input(container, 'Age'), '35');
    await changeSelect(select(container, 'Gender'), 'female');
    await changeSelect(select(container, 'Activity Level'), '1.9');
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Unsaved changes.');

    await click(container.querySelector<HTMLButtonElement>('[aria-label="Save profile changes"]')!);

    const profile = useMealPlannerStore.getState().profile;
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(profile).toMatchObject({
      fullName: 'Taylor Morgan',
      heightCm: feetInchesToCm(5, 14),
      currentWeightKg: lbsToKg(176),
      age: 35,
      gender: 'female',
      activityLevel: 1.9,
    });
    // 5 ft 14 in is intentionally normalized after conversion rather than persisted as an invalid split unit.
    expect(input(container, 'Height feet').value).toBe('6');
    expect(input(container, 'Height inches').value).toBe('2');
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Profile saved.');

    const summary = calculateMetabolicSummary(profile);
    expect(container.textContent).toContain(`BMR${Math.round(summary.bmr)} kcal`);
    expect(container.textContent).toContain(`Target Calories${Math.round(summary.targetCalories)} kcal`);
  });

  it('keeps every preference as a draft until Save and then applies it through the complete profile candidate', async () => {
    await mount();

    await click(button(container, 'Muscle Gain'));
    await click(button(container, 'Aldi'));
    await click(button(container, 'Mild'));
    await click(checkbox(container, 'sweet'));
    await click(checkbox(container, 'Milk'));
    await click(checkbox(container, 'Acid Reflux GERD'));
    await changeText(input(container, 'Custom exclusion'), 'Cilantro');
    await click(button(container, 'Add'));

    // Preference controls are controlled drafts, not immediate store mutations.
    expect(useMealPlannerStore.getState().profile).toEqual(freshProfile());
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Unsaved changes.');

    await click(container.querySelector<HTMLButtonElement>('[aria-label="Save profile changes"]')!);

    expect(useMealPlannerStore.getState().profile).toMatchObject({
      goal: 'muscle_gain',
      preferredStore: 'aldi',
      spiceLevel: 'mild',
      snackCravings: ['salty', 'sweet'],
      majorAllergens: ['milk'],
      giConditions: ['acid_reflux_gerd'],
      customExclusions: ['cilantro'],
    });
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Profile saved.');
  });

  it('adopts a hydrated profile before edits but does not clobber an active local draft on a later profile update', async () => {
    await mount();

    await act(async () => {
      useMealPlannerStore.setState({ profile: { ...freshProfile(), fullName: 'Hydrated Morgan', age: 41 }, hasHydrated: true });
    });
    expect(input(container, 'Full Name').value).toBe('Hydrated Morgan');
    expect(input(container, 'Age').value).toBe('41');

    await changeText(input(container, 'Full Name'), 'In-progress profile');
    await act(async () => {
      useMealPlannerStore.setState({ profile: { ...freshProfile(), fullName: 'Different hydrated profile', age: 52 }, hasHydrated: true });
    });

    expect(input(container, 'Full Name').value).toBe('In-progress profile');
    expect(input(container, 'Age').value).toBe('41');
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Unsaved changes.');
  });
});
