import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FOOD_CATALOG } from '@/lib/foodCatalog';
import { NUTRITION_DATABASE } from '@/data/nutritionDatabase';
import { getCuratedFoodPhoto } from '@/lib/foodPhotos';
import { evaluateDietarySafety } from '@/lib/fitnessMealPlanner';
import { DEFAULT_PROFILE } from '@/store/useMealPlannerStore';

const allSeeds = [...FOOD_CATALOG, ...NUTRITION_DATABASE];

describe('matching seeded food imagery and data', () => {
  it('covers all 41 stable seed identities with forty actual local assets', () => {
    expect(allSeeds).toHaveLength(41);
    const paths = new Set<string>();
    for (const item of allSeeds) {
      const image = getCuratedFoodPhoto({ id: item.id });
      expect(image, item.id).toBe(item.imageUrl);
      expect(image, item.id).toMatch(/^\/images\/foods\/[a-z0-9-]+\.webp$/);
      expect(existsSync(join(process.cwd(), 'public', image!)), item.id).toBe(true);
      const bytes = readFileSync(join(process.cwd(), 'public', image!));
      expect(bytes.subarray(0, 4).toString(), item.id).toBe('RIFF');
      expect(bytes.subarray(8, 12).toString(), item.id).toBe('WEBP');
      paths.add(image!);
    }
    expect(paths.size).toBe(40);
    expect(FOOD_CATALOG.every((food) => !food.barcode)).toBe(true);
  });

  it('retains source attribution for every committed food image', () => {
    const records = ['ingredient-sources', 'product-sources', 'illustration-sources'].flatMap((name) =>
      JSON.parse(readFileSync(join(process.cwd(), 'public/images/foods', `${name}.json`), 'utf8')) as { file: string }[],
    );
    const attributed = new Set(records.map((record) => record.file));
    for (const item of allSeeds) expect(attributed.has(item.imageUrl!), item.id).toBe(true);
    expect(attributed.size).toBe(40);
  });

  it('does not turn an unrelated generic brand name into an exact package photo', () => {
    expect(getCuratedFoodPhoto({ id: 'custom', name: 'Whole Milk' })).toBeUndefined();
    expect(getCuratedFoodPhoto({ id: 'custom', name: 'Whey Protein Isolate' })).toBeUndefined();
    expect(getCuratedFoodPhoto({ id: 'nutrition-nut-whole-milk' })).toBe('/images/foods/horizon-whole-milk.webp');
  });

  it('applies known allergen and supported official-label corrections without assuming photos verify every label', () => {
    const fries = NUTRITION_DATABASE.find((item) => item.id === 'nut-mcdonalds-fries')!;
    expect(fries.dietaryTags).not.toContain('vegan');
    expect(fries.allergens).toEqual(['wheat', 'milk']);
    expect(evaluateDietarySafety(fries, { ...DEFAULT_PROFILE, majorAllergens: ['milk'] }).hardBlocked).toBe(true);
    const bar = NUTRITION_DATABASE.find((item) => item.id === 'nut-protein-bar')!;
    expect(bar.allergens).toEqual(['milk', 'tree_nuts', 'soy']);
    expect(bar).toMatchObject({ calories: 190, fatGrams: 9 });
    expect(NUTRITION_DATABASE.find((item) => item.id === 'nut-whole-milk')).toMatchObject({ calories: 160, carbGrams: 13 });
    const riceCakes = FOOD_CATALOG.find((food) => food.id === 'rice-cakes')!;
    expect(riceCakes.dietaryTags.containsGluten).toBe(false);
    expect(evaluateDietarySafety(riceCakes, { ...DEFAULT_PROFILE, majorAllergens: ['wheat'] }).hardBlocked).toBe(false);
  });
});
