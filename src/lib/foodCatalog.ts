import type { CookingOption, DietaryTags, FoodItem, MealWindow } from './fitnessMealPlanner';
import { buildStorePrices } from './stores';

export type FoodCategory = 'protein' | 'carb' | 'fat' | 'vegetable' | 'snack';

export interface CatalogFoodItem extends FoodItem {
  category: FoodCategory;
  mealWindows: MealWindow[];
}

// Emoji fallback shown only if an image element has no usable src at all
export const CATEGORY_FALLBACK_ICON: Record<FoodCategory, string> = {
  protein: '🍗',
  carb: '🍞',
  fat: '🥑',
  vegetable: '🥦',
  snack: '🍿',
};

// Reusable cooking-option presets, tweakable per item via the optional overrides
const cookRaw = (): CookingOption => ({
  method: 'raw',
  prepTimeMinutes: 0,
  cookTimeMinutes: 0,
  macroMultiplier: { calories: 1, protein: 1, carbs: 1, fat: 1 },
});

const cookSteamed = (prepTimeMinutes = 5, cookTimeMinutes = 10): CookingOption => ({
  method: 'steamed',
  prepTimeMinutes,
  cookTimeMinutes,
  macroMultiplier: { calories: 0.95, protein: 1, carbs: 1, fat: 0.95 },
  cookingTip: 'Steaming preserves most nutrients with minimal calorie change.',
});

const cookBoiled = (prepTimeMinutes = 5, cookTimeMinutes = 12): CookingOption => ({
  method: 'boiled',
  prepTimeMinutes,
  cookTimeMinutes,
  macroMultiplier: { calories: 0.9, protein: 0.97, carbs: 1, fat: 0.85 },
  cookingTip: 'Some water-soluble nutrients and fat can leach into the cooking water.',
});

const cookBaked = (prepTimeMinutes = 5, cookTimeMinutes = 25, recommendedTempF = 400): CookingOption => ({
  method: 'baked',
  prepTimeMinutes,
  cookTimeMinutes,
  recommendedTempF,
  macroMultiplier: { calories: 1, protein: 1, carbs: 1, fat: 1 },
  cookingTip: 'Baking keeps macros close to raw values with a firmer texture.',
});

const cookGrilled = (prepTimeMinutes = 5, cookTimeMinutes = 12, recommendedTempF = 450): CookingOption => ({
  method: 'grilled',
  prepTimeMinutes,
  cookTimeMinutes,
  recommendedTempF,
  macroMultiplier: { calories: 0.95, protein: 1, carbs: 1, fat: 0.85 },
  cookingTip: 'Grilling lets excess fat drip away as it cooks.',
});

const cookPanFried = (prepTimeMinutes = 5, cookTimeMinutes = 10, addedFatGrams = 7): CookingOption => ({
  method: 'pan_fried',
  prepTimeMinutes,
  cookTimeMinutes,
  macroMultiplier: { calories: 1.2, protein: 1, carbs: 1, fat: 1.5 },
  addedFatGrams,
  cookingTip: 'Pan frying adds calories and fat from the cooking oil or butter.',
});

const cookAirFried = (prepTimeMinutes = 5, cookTimeMinutes = 15, recommendedTempF = 380): CookingOption => ({
  method: 'air_fried',
  prepTimeMinutes,
  cookTimeMinutes,
  recommendedTempF,
  macroMultiplier: { calories: 1.05, protein: 1, carbs: 1, fat: 1.1 },
  addedFatGrams: 1,
  cookingTip: 'Air frying uses little to no added oil for a crisp texture.',
});

// Convenience factory for dietary safeguard metadata, defaults to "no known triggers"
const tags = (overrides: Partial<DietaryTags> = {}): DietaryTags => ({
  allergens: [],
  isHighFodmap: false,
  isGerdTrigger: false,
  containsGluten: false,
  containsLactose: false,
  spiceLevel: 'none',
  ...overrides,
});

export const FOOD_CATALOG: CatalogFoodItem[] = [
  // ---- Protein ----
  {
    id: 'egg-whites',
    barcode: '', // Generic food: no verified product UPC.
    name: 'Egg Whites (Scrambled)',
    ingredients: ['egg white'],
    category: 'protein',
    imageUrl: '/images/foods/egg-whites.webp',
    cookingOptions: [cookSteamed(2, 5), cookPanFried(2, 4, 3)],
    dietaryTags: tags({ allergens: ['eggs'] }),
    portionRaw: '150g (raw liquid)',
    caloriesRaw: 78,
    portionCooked: '120g (cooked)',
    caloriesCooked: 90,
    proteinGrams: 16,
    carbGrams: 2,
    fatGrams: 0.5,
    snackProfile: ['high_protein'],
    estimatedPrices: buildStorePrices(2.5),
    mealWindows: ['breakfast'],
  },
  {
    id: 'grilled-chicken',
    barcode: '', // Generic food: no verified product UPC.
    name: 'Grilled Chicken Breast',
    ingredients: ['chicken breast'],
    category: 'protein',
    imageUrl: '/images/foods/chicken-breast.webp',
    cookingOptions: [cookGrilled(5, 12, 450), cookBaked(5, 25, 400), cookAirFried(5, 18, 380)],
    dietaryTags: tags(),
    portionRaw: '170g (raw)',
    caloriesRaw: 187,
    portionCooked: '130g (cooked)',
    caloriesCooked: 215,
    proteinGrams: 39,
    carbGrams: 0,
    fatGrams: 5,
    snackProfile: ['high_protein', 'savory'],
    estimatedPrices: buildStorePrices(3.5),
    mealWindows: ['lunch', 'dinner'],
  },
  {
    id: 'salmon',
    barcode: '', // Generic food: no verified product UPC.
    name: 'Baked Salmon Fillet',
    ingredients: ['salmon'],
    category: 'protein',
    imageUrl: '/images/foods/salmon.webp',
    cookingOptions: [cookBaked(5, 18, 400), cookGrilled(5, 10, 450), cookPanFried(5, 8, 5)],
    dietaryTags: tags({ allergens: ['fish'] }),
    portionRaw: '160g (raw)',
    caloriesRaw: 233,
    portionCooked: '125g (cooked)',
    caloriesCooked: 260,
    proteinGrams: 34,
    carbGrams: 0,
    fatGrams: 13,
    snackProfile: ['savory', 'high_protein'],
    estimatedPrices: buildStorePrices(6.5),
    mealWindows: ['dinner'],
  },
  {
    id: 'turkey-breast',
    barcode: '', // Generic food: no verified product UPC.
    name: 'Roasted Turkey Breast',
    ingredients: ['turkey breast'],
    category: 'protein',
    imageUrl: '/images/foods/turkey-breast.webp',
    cookingOptions: [cookBaked(5, 30, 375), cookGrilled(5, 14, 450)],
    dietaryTags: tags(),
    portionRaw: '170g (raw)',
    caloriesRaw: 180,
    portionCooked: '135g (cooked)',
    caloriesCooked: 200,
    proteinGrams: 36,
    carbGrams: 0,
    fatGrams: 3,
    snackProfile: ['high_protein', 'savory'],
    estimatedPrices: buildStorePrices(3.9),
    mealWindows: ['lunch', 'dinner'],
  },
  {
    id: 'tofu',
    barcode: '', // Generic food: no verified product UPC.
    name: 'Firm Tofu Cubes',
    ingredients: ['soybeans'],
    category: 'protein',
    imageUrl: '/images/foods/tofu.webp',
    cookingOptions: [cookPanFried(5, 8, 6), cookAirFried(5, 15, 380), cookSteamed(3, 8)],
    dietaryTags: tags({ allergens: ['soy'] }),
    portionRaw: '150g (raw)',
    caloriesRaw: 120,
    portionCooked: '140g (cooked)',
    caloriesCooked: 135,
    proteinGrams: 14,
    carbGrams: 3,
    fatGrams: 7,
    snackProfile: ['high_protein', 'savory'],
    estimatedPrices: buildStorePrices(1.8),
    mealWindows: ['lunch', 'dinner'],
  },
  // ---- Carb ----
  {
    id: 'oatmeal',
    barcode: '', // Generic food: no verified product UPC.
    name: 'Oatmeal with Berries',
    ingredients: ['oats', 'blueberries', 'water'],
    category: 'carb',
    imageUrl: '/images/foods/oatmeal.webp',
    cookingOptions: [cookBoiled(1, 5)],
    dietaryTags: tags(),
    portionRaw: '50g (dry oats)',
    caloriesRaw: 190,
    portionCooked: '220g (cooked)',
    caloriesCooked: 180,
    proteinGrams: 7,
    carbGrams: 34,
    fatGrams: 3,
    snackProfile: ['sweet'],
    estimatedPrices: buildStorePrices(1.2),
    mealWindows: ['breakfast'],
  },
  {
    id: 'brown-rice',
    barcode: '', // Generic food: no verified product UPC.
    name: 'Brown Rice',
    ingredients: ['brown rice'],
    category: 'carb',
    imageUrl: '/images/foods/brown-rice.webp',
    cookingOptions: [cookBoiled(2, 35)],
    dietaryTags: tags(),
    portionRaw: '90g (raw)',
    caloriesRaw: 325,
    portionCooked: '195g (cooked)',
    caloriesCooked: 215,
    proteinGrams: 5,
    carbGrams: 45,
    fatGrams: 1.8,
    snackProfile: ['savory'],
    estimatedPrices: buildStorePrices(0.9),
    mealWindows: ['lunch', 'dinner'],
  },
  {
    id: 'sweet-potato',
    barcode: '', // Generic food: no verified product UPC.
    name: 'Roasted Sweet Potato',
    ingredients: ['sweet potato'],
    category: 'carb',
    imageUrl: '/images/foods/sweet-potato.webp',
    cookingOptions: [cookBaked(5, 45, 400), cookBoiled(5, 20), cookAirFried(5, 20, 400)],
    dietaryTags: tags(),
    portionRaw: '200g (raw)',
    caloriesRaw: 172,
    portionCooked: '160g (cooked)',
    caloriesCooked: 150,
    proteinGrams: 3,
    carbGrams: 35,
    fatGrams: 0.2,
    snackProfile: ['sweet', 'savory'],
    estimatedPrices: buildStorePrices(1.0),
    mealWindows: ['lunch', 'dinner'],
  },
  {
    id: 'whole-wheat-bread',
    barcode: '', // Generic food: no verified product UPC.
    name: 'Whole Wheat Toast',
    ingredients: ['whole wheat flour'],
    category: 'carb',
    imageUrl: '/images/foods/wholegrain-bread.webp',
    cookingOptions: [cookBaked(0, 3, 400)],
    dietaryTags: tags({ allergens: ['wheat'], containsGluten: true, isHighFodmap: true }),
    portionRaw: '2 slices (70g)',
    caloriesRaw: 170,
    portionCooked: '2 slices, toasted (65g)',
    caloriesCooked: 165,
    proteinGrams: 8,
    carbGrams: 30,
    fatGrams: 2,
    snackProfile: ['savory'],
    estimatedPrices: buildStorePrices(0.6),
    mealWindows: ['breakfast'],
  },
  // ---- Fat ----
  {
    id: 'almonds',
    barcode: '', // Generic food: no verified product UPC.
    name: 'Raw Almonds',
    ingredients: ['almonds'],
    category: 'fat',
    imageUrl: '/images/foods/almonds.webp',
    cookingOptions: [cookRaw(), cookBaked(2, 10, 325)],
    dietaryTags: tags({ allergens: ['tree_nuts'] }),
    portionRaw: '28g',
    caloriesRaw: 164,
    portionCooked: '28g (roasted)',
    caloriesCooked: 170,
    proteinGrams: 6,
    carbGrams: 6,
    fatGrams: 14,
    snackProfile: ['crunchy', 'salty', 'high_protein'],
    estimatedPrices: buildStorePrices(1.3),
    mealWindows: ['snacks'],
  },
  {
    id: 'avocado',
    barcode: '', // Generic food: no verified product UPC.
    name: 'Avocado (Half)',
    ingredients: ['avocado'],
    category: 'fat',
    imageUrl: '/images/foods/avocado.webp',
    cookingOptions: [cookRaw()],
    dietaryTags: tags({ isHighFodmap: true }),
    portionRaw: '100g (raw)',
    caloriesRaw: 160,
    portionCooked: '95g (grilled)',
    caloriesCooked: 155,
    proteinGrams: 2,
    carbGrams: 9,
    fatGrams: 15,
    snackProfile: ['savory'],
    estimatedPrices: buildStorePrices(0.9),
    mealWindows: ['lunch', 'dinner'],
  },
  {
    id: 'peanut-butter',
    barcode: '', // Generic food: no verified product UPC.
    name: 'Peanut Butter (2 tbsp)',
    ingredients: ['peanuts'],
    category: 'fat',
    imageUrl: '/images/foods/peanut-butter.webp',
    cookingOptions: [cookRaw()],
    dietaryTags: tags({ allergens: ['peanuts'] }),
    portionRaw: '32g',
    caloriesRaw: 190,
    portionCooked: '32g',
    caloriesCooked: 190,
    proteinGrams: 7,
    carbGrams: 6,
    fatGrams: 16,
    snackProfile: ['sweet', 'savory', 'high_protein'],
    estimatedPrices: buildStorePrices(1.4),
    mealWindows: ['snacks'],
  },
  // ---- Vegetable ----
  {
    id: 'roasted-veggies',
    barcode: '', // Generic food: no verified product UPC.
    name: 'Roasted Mixed Vegetables',
    ingredients: ['broccoli', 'carrot', 'bell pepper', 'garlic'],
    category: 'vegetable',
    imageUrl: '/images/foods/roasted-vegetables.webp',
    cookingOptions: [cookBaked(10, 25, 425), cookAirFried(8, 15, 400)],
    dietaryTags: tags({ isHighFodmap: true, isGerdTrigger: true, spiceLevel: 'medium' }),
    portionRaw: '200g (raw)',
    caloriesRaw: 90,
    portionCooked: '150g (cooked)',
    caloriesCooked: 110,
    proteinGrams: 3,
    carbGrams: 18,
    fatGrams: 2,
    snackProfile: ['savory', 'crunchy'],
    estimatedPrices: buildStorePrices(1.8),
    mealWindows: ['lunch', 'dinner'],
  },
  {
    id: 'broccoli',
    barcode: '', // Generic food: no verified product UPC.
    name: 'Steamed Broccoli',
    ingredients: ['broccoli'],
    category: 'vegetable',
    imageUrl: '/images/foods/broccoli.webp',
    cookingOptions: [cookSteamed(2, 6), cookBoiled(2, 5), cookBaked(5, 20, 425)],
    dietaryTags: tags({ isHighFodmap: true }),
    portionRaw: '180g (raw)',
    caloriesRaw: 61,
    portionCooked: '160g (steamed)',
    caloriesCooked: 55,
    proteinGrams: 4,
    carbGrams: 11,
    fatGrams: 0.6,
    snackProfile: ['savory', 'crunchy'],
    estimatedPrices: buildStorePrices(1.2),
    mealWindows: ['lunch', 'dinner'],
  },
  {
    id: 'spinach-salad',
    barcode: '', // Generic food: no verified product UPC.
    name: 'Spinach Salad Mix',
    ingredients: ['spinach', 'cucumber', 'tomato'],
    category: 'vegetable',
    imageUrl: '/images/foods/spinach.webp',
    cookingOptions: [cookRaw(), cookPanFried(2, 3, 2)],
    dietaryTags: tags(),
    portionRaw: '85g (raw)',
    caloriesRaw: 20,
    portionCooked: '75g (sauteed)',
    caloriesCooked: 35,
    proteinGrams: 2,
    carbGrams: 3,
    fatGrams: 0.3,
    snackProfile: ['savory'],
    estimatedPrices: buildStorePrices(2.0),
    mealWindows: ['lunch', 'dinner'],
  },
  // ---- Snack ----
  {
    id: 'pretzels',
    barcode: '', // Generic food: no verified product UPC.
    name: 'Mini Pretzels',
    ingredients: ['wheat flour'],
    category: 'snack',
    imageUrl: '/images/foods/pretzels.webp',
    cookingOptions: [cookRaw()],
    dietaryTags: tags({ allergens: ['wheat'], containsGluten: true }),
    portionRaw: '30g',
    caloriesRaw: 110,
    portionCooked: '30g',
    caloriesCooked: 110,
    proteinGrams: 3,
    carbGrams: 23,
    fatGrams: 1,
    snackProfile: ['salty', 'crunchy'],
    estimatedPrices: buildStorePrices(0.6),
    mealWindows: ['snacks'],
  },
  {
    id: 'greek-yogurt',
    barcode: '', // Generic food: no verified product UPC.
    name: 'Greek Yogurt Cup',
    ingredients: ['milk'],
    category: 'snack',
    imageUrl: '/images/foods/greek-yogurt.webp',
    cookingOptions: [cookRaw()],
    dietaryTags: tags({ allergens: ['milk'], containsLactose: true }),
    portionRaw: '170g',
    caloriesRaw: 100,
    portionCooked: '170g',
    caloriesCooked: 100,
    proteinGrams: 17,
    carbGrams: 6,
    fatGrams: 0,
    snackProfile: ['high_protein', 'sweet'],
    estimatedPrices: buildStorePrices(1.1),
    mealWindows: ['snacks'],
  },
  {
    id: 'trail-mix',
    barcode: '', // Generic food: no verified product UPC.
    name: 'Trail Mix',
    ingredients: ['almonds', 'peanuts', 'cashews', 'raisins', 'chocolate'],
    category: 'snack',
    imageUrl: '/images/foods/trail-mix.webp',
    cookingOptions: [cookRaw()],
    dietaryTags: tags({ allergens: ['tree_nuts', 'peanuts'] }),
    portionRaw: '40g',
    caloriesRaw: 190,
    portionCooked: '40g',
    caloriesCooked: 190,
    proteinGrams: 5,
    carbGrams: 17,
    fatGrams: 12,
    snackProfile: ['sweet', 'crunchy', 'savory'],
    estimatedPrices: buildStorePrices(1.5),
    mealWindows: ['snacks'],
  },
  {
    id: 'jerky',
    barcode: '', // Generic food: no verified product UPC.
    name: 'Beef Jerky',
    ingredients: ['beef', 'soy sauce'],
    category: 'snack',
    imageUrl: '/images/foods/beef-jerky.webp',
    cookingOptions: [cookRaw()],
    dietaryTags: tags({ allergens: ['soy'], isGerdTrigger: true, spiceLevel: 'mild' }),
    portionRaw: '28g',
    caloriesRaw: 80,
    portionCooked: '28g',
    caloriesCooked: 80,
    proteinGrams: 11,
    carbGrams: 3,
    fatGrams: 1.5,
    snackProfile: ['salty', 'savory', 'high_protein'],
    estimatedPrices: buildStorePrices(1.9),
    mealWindows: ['snacks'],
  },
  {
    id: 'rice-cakes',
    barcode: '', // Generic food: no verified product UPC.
    name: 'Salted Rice Cakes',
    ingredients: ['brown rice', 'salt'],
    category: 'snack',
    imageUrl: '/images/foods/rice-cakes.webp',
    cookingOptions: [cookRaw()],
    dietaryTags: tags({}), // Plain rice-and-salt recipe; check packaged labels for cross-contact.
    portionRaw: '2 cakes (18g)',
    caloriesRaw: 70,
    portionCooked: '2 cakes (18g)',
    caloriesCooked: 70,
    proteinGrams: 1,
    carbGrams: 15,
    fatGrams: 0.5,
    snackProfile: ['salty', 'crunchy'],
    estimatedPrices: buildStorePrices(0.5),
    mealWindows: ['snacks'],
  },
];

export interface SafeSwapSuggestion {
  /** Present when the alternative is itself a catalog item (id reference) */
  alternativeFoodId?: string;
  alternativeName: string;
  reason: string;
}

// One-click "safe swap" suggestions for foods commonly flagged by allergy/GI warnings
export const SAFE_SWAPS: Record<string, SafeSwapSuggestion> = {
  'greek-yogurt': {
    alternativeName: 'Coconut Yogurt (Dairy-Free)',
    reason: 'Dairy-free option; protein content varies, so check the label.',
  },
  'whole-wheat-bread': {
    alternativeName: 'Certified Gluten-Free Bread',
    reason: 'Gluten-free toast alternative with comparable carbs.',
  },
  'peanut-butter': {
    alternativeName: 'Sunflower Seed Butter',
    reason: 'Nut-free spread with a similar fat and protein profile.',
  },
  almonds: {
    alternativeName: 'Roasted Pumpkin Seeds',
    reason: 'Nut-free, crunchy snack with comparable healthy fats.',
  },
  tofu: {
    alternativeFoodId: 'grilled-chicken',
    alternativeName: 'Grilled Chicken Breast',
    reason: 'Soy-free protein with a similar calorie and protein profile.',
  },
  salmon: {
    alternativeFoodId: 'grilled-chicken',
    alternativeName: 'Grilled Chicken Breast',
    reason: 'Fish-free protein alternative with comparable protein.',
  },
  'roasted-veggies': {
    alternativeFoodId: 'spinach-salad',
    alternativeName: 'Spinach Salad Mix',
    reason: 'Garlic-free, low-FODMAP, and milder on GERD symptoms.',
  },
  broccoli: {
    alternativeFoodId: 'spinach-salad',
    alternativeName: 'Spinach Salad Mix',
    reason: 'Lower-FODMAP vegetable option for sensitive stomachs.',
  },
  'trail-mix': {
    alternativeFoodId: 'rice-cakes',
    alternativeName: 'Salted Rice Cakes',
    reason: 'Nut-free crunchy snack alternative.',
  },
  pretzels: {
    alternativeFoodId: 'rice-cakes',
    alternativeName: 'Salted Rice Cakes',
    reason: 'Gluten-free crunchy snack alternative.',
  },
  jerky: {
    alternativeFoodId: 'greek-yogurt',
    alternativeName: 'Greek Yogurt Cup',
    reason: 'Soy-free, milder high-protein snack.',
  },
};

/** Look up a gut/allergy-friendly swap suggestion for a catalog food, if one exists. */
export function getSafeSwap(foodId: string): SafeSwapSuggestion | undefined {
  return SAFE_SWAPS[foodId];
}
