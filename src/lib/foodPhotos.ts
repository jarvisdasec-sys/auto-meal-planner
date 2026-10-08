// Exact, curated identities only: no fuzzy first-result photo matching.
// Local assets are food illustrations, not proofs of portion weight or nutrition.
const photos: Record<string, { file: string; names: string[] }> = {
  'egg-whites': { file: 'egg-whites', names: ['Egg Whites (Scrambled)'] },
  'grilled-chicken': { file: 'chicken-breast', names: ['Grilled Chicken Breast'] },
  salmon: { file: 'salmon', names: ['Baked Salmon Fillet'] },
  'turkey-breast': { file: 'turkey-breast', names: ['Roasted Turkey Breast'] },
  tofu: { file: 'tofu', names: ['Firm Tofu Cubes'] },
  oatmeal: { file: 'oatmeal', names: ['Oatmeal with Berries'] },
  'brown-rice': { file: 'brown-rice', names: ['Brown Rice'] },
  'sweet-potato': { file: 'sweet-potato', names: ['Roasted Sweet Potato'] },
  'whole-wheat-bread': { file: 'wholegrain-bread', names: ['Whole Wheat Toast'] },
  almonds: { file: 'almonds', names: ['Raw Almonds'] },
  avocado: { file: 'avocado', names: ['Avocado (Half)'] },
  'peanut-butter': { file: 'peanut-butter', names: ['Peanut Butter (2 tbsp)'] },
  'roasted-veggies': { file: 'roasted-vegetables', names: ['Roasted Mixed Vegetables'] },
  broccoli: { file: 'broccoli', names: ['Steamed Broccoli'] },
  'spinach-salad': { file: 'spinach', names: ['Spinach Salad Mix'] },
  pretzels: { file: 'pretzels', names: ['Mini Pretzels'] },
  'greek-yogurt': { file: 'greek-yogurt', names: ['Greek Yogurt Cup'] },
  'trail-mix': { file: 'trail-mix', names: ['Trail Mix'] },
  jerky: { file: 'beef-jerky', names: ['Beef Jerky'] },
  'rice-cakes': { file: 'rice-cakes', names: ['Salted Rice Cakes'] },
  'nut-ribeye-steak': { file: 'ribeye-steak', names: ['Ribeye Steak'] },
  'nut-chicken-thigh': { file: 'chicken-thigh', names: ['Boneless Chicken Thigh'] },
  'nut-tuna-canned': { file: 'starkist-tuna', names: ['Canned Tuna in Water'] },
  'nut-shrimp': { file: 'shrimp', names: ['Steamed Shrimp'] },
  'nut-whole-milk': { file: 'horizon-whole-milk', names: ['Whole Milk'] },
  'nut-cheddar-cheese': { file: 'cheddar-cheese', names: ['Sharp Cheddar Cheese'] },
  'nut-quinoa': { file: 'quinoa', names: ['Cooked Quinoa'] },
  'nut-sourdough': { file: 'sourdough-bread', names: ['Sourdough Bread Slice'] },
  'nut-black-beans': { file: 'black-beans', names: ['Black Beans'] },
  'nut-broccoli-florets': { file: 'broccoli', names: ['Steamed Broccoli Florets'] },
  'nut-banana': { file: 'banana', names: ['Banana'] },
  'nut-blueberries': { file: 'blueberries', names: ['Blueberries'] },
  'nut-olive-oil': { file: 'olive-oil', names: ['Extra Virgin Olive Oil'] },
  'nut-cold-brew': { file: 'cold-brew', names: ['Black Cold Brew Coffee'] },
  'nut-protein-bar': { file: 'quest-protein-bar', names: ['Chocolate Chip Protein Bar'] },
  'nut-mcdonalds-fries': { file: 'mcdonalds-fries', names: ['Medium French Fries'] },
  'sup-whey-protein': { file: 'whey-protein-isolate', names: ['Whey Protein Isolate'] },
  'sup-creatine': { file: 'creatine-us', names: ['Creatine Monohydrate'] },
  'sup-pre-workout': { file: 'pre-workout', names: ['Pre-Workout Energy Blend'] },
  'sup-bcaa': { file: 'bcaa', names: ['BCAA Recovery Powder'] },
  'sup-fish-oil': { file: 'omega-3', names: ['Omega-3 Fish Oil'] },
};

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

const brandedIds = new Set([
  'nut-tuna-canned', 'nut-whole-milk', 'nut-protein-bar', 'nut-mcdonalds-fries',
  'sup-whey-protein', 'sup-creatine', 'sup-pre-workout', 'sup-bcaa', 'sup-fish-oil',
]);

const namePhotos = new Map(
  Object.entries(photos)
    .filter(([id]) => !brandedIds.has(id))
    .flatMap(([, { file, names }]) => names.map((name) => [normalize(name), file] as const)),
);

export function getCuratedFoodPhoto(item: { id?: string; name?: string }): string | undefined {
  const id = item.id?.replace(/^nutrition-/, '');
  const file = (id ? photos[id]?.file : undefined) ?? (item.name ? namePhotos.get(normalize(item.name)) : undefined);
  return file ? `/images/foods/${file}.webp` : undefined;
}

export const CURATED_FOOD_PHOTOS = photos;
