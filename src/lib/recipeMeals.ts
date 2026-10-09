import { addDays, type DateKey } from './dateKeys';
import { evaluateDietarySafety, type Allergen, type DietaryTags, type MealWindow, type UserProfile } from './fitnessMealPlanner';
import { toCsv } from './premiumPlanner';

/**
 * Generic ingredient nutrition planning inputs, rounded to measured grams. They are
 * illustrative estimates, not product labels or a verified database citation; check
 * your package label and ingredient list before preparing or eating.
 */
export const RECIPE_NUTRITION_REFERENCE = 'Generic ingredient nutrition planning estimates, rounded to per-gram values; not product labels or verified database citations.';
/** Prices are illustrative generic US grocery planning inputs, not live store offers. */
export const RECIPE_PRICE_REFERENCE = 'Illustrative generic US grocery price estimates per measured gram; not live store prices, quotes, or a budget guarantee.';

export type RecipeDietPreference = 'balanced' | 'high_protein' | 'vegetarian' | 'plant_based';
export const RECIPE_DIET_PREFERENCES: RecipeDietPreference[] = ['balanced', 'high_protein', 'vegetarian', 'plant_based'];
export const RECIPE_TIME_OPTIONS = [15, 30, 45] as const;
export type RecipeTimePreference = (typeof RECIPE_TIME_OPTIONS)[number];

export interface RecipeNutrition {
  calories: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
}

export interface RecipeIngredient {
  id: string;
  name: string;
  aisle: string;
  /** The state/basis being weighed, such as dry oats or cooked rice. */
  measuredAs: string;
  nutritionPerGram: RecipeNutrition;
  /** Deliberately generic planning estimate, not a retailer or brand price. */
  illustrativePricePerGramUsd: number;
  allergens: Allergen[];
  dietaryFlags: DietaryTags;
}

export interface RecipeIngredientAmount {
  ingredientId: string;
  grams: number;
  note?: string;
}

export interface RecipeMeal {
  id: string;
  name: string;
  mealWindow: MealWindow;
  yieldServings: number;
  ingredients: RecipeIngredientAmount[];
  instructions: string[];
  prepMinutes: number;
  cookMinutes: number;
  dietTags: Array<'high_protein' | 'vegetarian' | 'plant_based'>;
  imageUrl: string;
  dietaryFlags: DietaryTags;
}

export interface RecipeWeekPreferences {
  startDateKey: DateKey;
  diet: RecipeDietPreference;
  maxTotalMinutes: RecipeTimePreference;
}

export interface RecipeWeekSlot {
  day: number;
  mealWindow: MealWindow;
  recipeId: string;
  /** Personal recipe servings, never household-scaled. */
  servings: number;
}

export interface RecipeWeekPlan {
  id: string;
  startDateKey: DateKey;
  preferences: RecipeWeekPreferences;
  slots: RecipeWeekSlot[];
  createdAt: string;
  updatedAt: string;
}

const noFlags = (overrides: Partial<DietaryTags> = {}): DietaryTags => ({
  allergens: [], isHighFodmap: false, isGerdTrigger: false, containsGluten: false, containsLactose: false, spiceLevel: 'none', ...overrides,
});

const ingredient = (
  id: string,
  name: string,
  aisle: string,
  measuredAs: string,
  calories: number,
  proteinGrams: number,
  carbGrams: number,
  fatGrams: number,
  illustrativePricePerGramUsd: number,
  dietaryFlags: DietaryTags = noFlags(),
): RecipeIngredient => ({ id, name, aisle, measuredAs, nutritionPerGram: { calories, proteinGrams, carbGrams, fatGrams }, illustrativePricePerGramUsd, allergens: dietaryFlags.allergens, dietaryFlags });

/**
 * All quantities are grams in the stated measured state. Nutrition and cost in every
 * recipe-week surface are calculated from this same catalog.
 */
export const RECIPE_INGREDIENTS: RecipeIngredient[] = [
  ingredient('rolled-oats', 'Rolled oats', 'Breakfast & grains', 'dry', 3.89, 0.169, 0.663, 0.069, 0.004),
  ingredient('water', 'Water', 'Kitchen / tap', 'cold water', 0, 0, 0, 0, 0),
  ingredient('banana', 'Banana', 'Produce', 'raw, peeled', 0.89, 0.011, 0.228, 0.003, 0.003),
  ingredient('blueberries', 'Blueberries', 'Produce', 'raw', 0.57, 0.007, 0.145, 0.003, 0.010),
  ingredient('chia-seeds', 'Chia seeds', 'Breakfast & grains', 'dry', 4.86, 0.165, 0.421, 0.307, 0.016),
  ingredient('maple-syrup', 'Maple syrup', 'Condiments', 'liquid', 2.60, 0, 0.671, 0, 0.012),
  ingredient('egg', 'Whole egg', 'Refrigerated', 'raw, without shell', 1.43, 0.126, 0.007, 0.095, 0.006, noFlags({ allergens: ['eggs'] })),
  ingredient('spinach', 'Spinach', 'Produce', 'raw', 0.23, 0.029, 0.036, 0.004, 0.010),
  ingredient('wholegrain-bread', 'Whole-grain bread', 'Bakery', 'ready to eat', 2.47, 0.130, 0.410, 0.042, 0.008, noFlags({ allergens: ['wheat'], containsGluten: true })),
  ingredient('olive-oil', 'Olive oil', 'Oils & condiments', 'liquid', 8.84, 0, 0, 1, 0.012),
  ingredient('peanut-butter', 'Peanut butter', 'Pantry', 'ready to eat', 5.88, 0.251, 0.200, 0.500, 0.010, noFlags({ allergens: ['peanuts'] })),
  ingredient('tofu', 'Firm tofu', 'Refrigerated', 'drained', 1.44, 0.173, 0.028, 0.089, 0.009, noFlags({ allergens: ['soy'] })),
  ingredient('sweet-potato', 'Sweet potato', 'Produce', 'raw', 0.86, 0.016, 0.201, 0.001, 0.004),
  ingredient('avocado', 'Avocado', 'Produce', 'raw', 1.60, 0.020, 0.085, 0.147, 0.010, noFlags({ isHighFodmap: true })),
  ingredient('chicken-breast', 'Chicken breast', 'Meat & seafood', 'raw, boneless skinless', 1.20, 0.225, 0, 0.026, 0.012),
  ingredient('quinoa', 'Quinoa, cooked (ready-to-eat)', 'Grains', 'cooked / ready-to-eat', 1.20, 0.044, 0.213, 0.019, 0.006),
  ingredient('broccoli', 'Broccoli', 'Produce', 'raw', 0.34, 0.028, 0.066, 0.004, 0.007),
  ingredient('turkey-breast', 'Turkey breast', 'Meat & seafood', 'cooked, sliced', 1.35, 0.290, 0, 0.016, 0.014),
  ingredient('brown-rice', 'Brown rice, cooked (ready-to-eat)', 'Grains', 'cooked / ready-to-eat', 1.23, 0.026, 0.256, 0.010, 0.004),
  ingredient('cucumber', 'Cucumber', 'Produce', 'raw', 0.15, 0.007, 0.036, 0.001, 0.005),
  ingredient('tuna', 'Canned light tuna in water', 'Meat & seafood', 'drained', 1.16, 0.259, 0, 0.008, 0.018, noFlags({ allergens: ['fish'] })),
  ingredient('black-beans', 'Black beans', 'Canned & dry goods', 'cooked, drained', 1.32, 0.089, 0.237, 0.005, 0.004, noFlags({ isHighFodmap: true })),
  ingredient('salmon', 'Salmon', 'Meat & seafood', 'raw', 2.08, 0.200, 0, 0.130, 0.024, noFlags({ allergens: ['fish'] })),
  ingredient('zucchini', 'Zucchini', 'Produce', 'raw', 0.17, 0.012, 0.031, 0.003, 0.006),
  ingredient('beef', 'Lean beef steak (intact cut)', 'Meat & seafood', 'raw, intact cut', 1.72, 0.206, 0, 0.096, 0.020),
  ingredient('bell-pepper', 'Bell pepper', 'Produce', 'raw', 0.31, 0.010, 0.060, 0.003, 0.010),
  ingredient('greek-yogurt', 'Nonfat Greek yogurt', 'Refrigerated', 'ready to eat', 0.59, 0.103, 0.036, 0.004, 0.008, noFlags({ allergens: ['milk'], containsLactose: true })),
  ingredient('rice-cake', 'Plain rice cake', 'Snacks', 'ready to eat', 3.87, 0.080, 0.813, 0.028, 0.010),
  ingredient('almonds', 'Almonds', 'Pantry', 'raw', 5.79, 0.212, 0.216, 0.499, 0.014, noFlags({ allergens: ['tree_nuts'] })),
  ingredient('lemon-juice', 'Lemon juice', 'Produce', 'fresh', 0.22, 0.004, 0.069, 0.002, 0.006, noFlags({ isGerdTrigger: true })),
  ingredient('cinnamon', 'Ground cinnamon', 'Spices', 'dry', 2.47, 0.040, 0.806, 0.012, 0.020),
];

export const RECIPE_INGREDIENT_BY_ID = Object.fromEntries(RECIPE_INGREDIENTS.map((item) => [item.id, item])) as Record<string, RecipeIngredient>;

function aggregateFlags(ingredientIds: string[]): DietaryTags {
  const facts = ingredientIds.map((id) => RECIPE_INGREDIENT_BY_ID[id]?.dietaryFlags).filter(Boolean) as DietaryTags[];
  return {
    allergens: [...new Set(facts.flatMap((fact) => fact.allergens))],
    isHighFodmap: facts.some((fact) => fact.isHighFodmap),
    isGerdTrigger: facts.some((fact) => fact.isGerdTrigger),
    containsGluten: facts.some((fact) => fact.containsGluten),
    containsLactose: facts.some((fact) => fact.containsLactose),
    spiceLevel: facts.some((fact) => fact.spiceLevel === 'spicy') ? 'spicy' : facts.some((fact) => fact.spiceLevel === 'medium') ? 'medium' : facts.some((fact) => fact.spiceLevel === 'mild') ? 'mild' : 'none',
  };
}

function meal(
  id: string,
  name: string,
  mealWindow: MealWindow,
  yieldServings: number,
  ingredients: RecipeIngredientAmount[],
  instructions: string[],
  prepMinutes: number,
  cookMinutes: number,
  dietTags: RecipeMeal['dietTags'],
  imageUrl: string,
): RecipeMeal {
  return { id, name, mealWindow, yieldServings, ingredients, instructions, prepMinutes, cookMinutes, dietTags, imageUrl, dietaryFlags: aggregateFlags(ingredients.map((item) => item.ingredientId)) };
}

/** Complete, measured, easy recipes. The image paths point to existing ingredient artwork. */
export const RECIPE_MEALS: RecipeMeal[] = [
  meal('blueberry-chia-oats', 'Blueberry Chia Overnight Oats', 'breakfast', 2, [{ ingredientId: 'rolled-oats', grams: 100 }, { ingredientId: 'water', grams: 480 }, { ingredientId: 'banana', grams: 120 }, { ingredientId: 'blueberries', grams: 140 }, { ingredientId: 'chia-seeds', grams: 24 }, { ingredientId: 'maple-syrup', grams: 20 }, { ingredientId: 'cinnamon', grams: 2 }], ['Use the ingredient quantities shown for the servings you are making. Stir oats, cold water, chia, cinnamon, and maple syrup; divide into the required containers.', 'Fold in half the blueberries; cover and refrigerate overnight.', 'Top each portion with banana and remaining blueberries before eating. Active preparation takes about 10 minutes; overnight chilling is additional.'], 10, 0, ['vegetarian', 'plant_based'], '/images/foods/oatmeal.webp'),
  meal('spinach-egg-toast', 'Spinach Egg Toast', 'breakfast', 1, [{ ingredientId: 'egg', grams: 100 }, { ingredientId: 'spinach', grams: 45 }, { ingredientId: 'wholegrain-bread', grams: 56 }, { ingredientId: 'olive-oil', grams: 5 }], ['Warm oil in a skillet over medium heat.', 'Wilt spinach, add beaten egg, and scramble until set.', 'Toast bread and serve the eggs over it.'], 5, 8, ['vegetarian', 'high_protein'], '/images/foods/egg-whites.webp'),
  meal('peanut-banana-oats', 'Peanut Banana Protein Oats', 'breakfast', 1, [{ ingredientId: 'rolled-oats', grams: 60 }, { ingredientId: 'water', grams: 240 }, { ingredientId: 'peanut-butter', grams: 24 }, { ingredientId: 'banana', grams: 100 }, { ingredientId: 'chia-seeds', grams: 12 }, { ingredientId: 'cinnamon', grams: 1 }], ['Cook oats with the water quantity shown for your servings, following the package directions.', 'Stir in peanut butter and cinnamon.', 'Top with sliced banana and chia seeds.'], 5, 8, ['vegetarian'], '/images/foods/peanut-butter.webp'),
  meal('tofu-sweet-potato-hash', 'Tofu Sweet Potato Breakfast Hash', 'breakfast', 2, [{ ingredientId: 'tofu', grams: 300 }, { ingredientId: 'sweet-potato', grams: 300 }, { ingredientId: 'spinach', grams: 80 }, { ingredientId: 'olive-oil', grams: 10 }], ['Microwave or steam diced sweet potato until just tender.', 'Crumble tofu into warm oil and cook until lightly golden.', 'Add sweet potato and spinach; cook until spinach wilts.'], 10, 15, ['vegetarian', 'plant_based', 'high_protein'], '/images/foods/tofu.webp'),
  meal('chicken-quinoa-broccoli-bowl', 'Chicken Quinoa Broccoli Bowl', 'lunch', 2, [{ ingredientId: 'chicken-breast', grams: 300 }, { ingredientId: 'quinoa', grams: 300 }, { ingredientId: 'broccoli', grams: 220 }, { ingredientId: 'olive-oil', grams: 10 }], ['Season chicken and cook in a skillet or bake until the thickest part reaches 165°F; slice.', 'Steam broccoli until crisp-tender.', 'Divide ready-to-eat cooked quinoa, broccoli, chicken, and oil between the required servings.'], 10, 20, ['high_protein'], '/images/foods/chicken-breast.webp'),
  meal('turkey-avocado-sandwich', 'Turkey Avocado Sandwich', 'lunch', 1, [{ ingredientId: 'turkey-breast', grams: 100 }, { ingredientId: 'wholegrain-bread', grams: 84 }, { ingredientId: 'avocado', grams: 50 }, { ingredientId: 'spinach', grams: 25 }, { ingredientId: 'cucumber', grams: 60 }], ['Mash avocado on one slice of bread.', 'Layer turkey, spinach, and cucumber.', 'Close, slice, and pack chilled.'], 10, 0, ['high_protein'], '/images/foods/turkey-breast.webp'),
  meal('tuna-black-bean-salad', 'Tuna & Black Bean Salad', 'lunch', 2, [{ ingredientId: 'tuna', grams: 240 }, { ingredientId: 'black-beans', grams: 260 }, { ingredientId: 'cucumber', grams: 160 }, { ingredientId: 'bell-pepper', grams: 140 }, { ingredientId: 'olive-oil', grams: 10 }], ['Rinse and drain beans well.', 'Combine tuna, beans, cucumber, and pepper.', 'Toss with oil and divide into the required containers.'], 15, 0, ['high_protein'], '/images/foods/starkist-tuna.webp'),
  meal('tofu-rice-veggie-bowl', 'Tofu Brown Rice Veggie Bowl', 'lunch', 2, [{ ingredientId: 'tofu', grams: 300 }, { ingredientId: 'brown-rice', grams: 320 }, { ingredientId: 'zucchini', grams: 220 }, { ingredientId: 'bell-pepper', grams: 160 }, { ingredientId: 'olive-oil', grams: 10 }], ['Brown tofu in a nonstick skillet with half the oil.', 'Sauté zucchini and pepper until tender-crisp.', 'Divide rice, tofu, vegetables, and remaining oil between bowls.'], 12, 15, ['vegetarian', 'plant_based', 'high_protein'], '/images/foods/brown-rice.webp'),
  meal('quick-tofu-rice-skillet', 'Quick Tofu Rice Skillet', 'dinner', 2, [{ ingredientId: 'tofu', grams: 300 }, { ingredientId: 'brown-rice', grams: 320 }, { ingredientId: 'zucchini', grams: 180 }, { ingredientId: 'bell-pepper', grams: 140 }, { ingredientId: 'olive-oil', grams: 8 }], ['Warm oil in a skillet and brown the tofu cubes.', 'Add zucchini and pepper; cook until tender-crisp.', 'Fold in cooked rice, heat through, and divide into the required servings.'], 7, 8, ['vegetarian', 'plant_based', 'high_protein'], '/images/foods/tofu.webp'),
  meal('salmon-sweet-potato-tray', 'Salmon, Sweet Potato & Broccoli Tray', 'dinner', 2, [{ ingredientId: 'salmon', grams: 300 }, { ingredientId: 'sweet-potato', grams: 350 }, { ingredientId: 'broccoli', grams: 240 }, { ingredientId: 'olive-oil', grams: 12 }], ['Heat oven to 425°F. Toss sweet potato with half the oil and roast for 15 minutes.', 'Add salmon and broccoli with remaining oil.', 'Roast 12–15 minutes more, until the thickest part of salmon reaches 145°F and vegetables are tender.'], 12, 30, ['high_protein'], '/images/foods/salmon.webp'),
  meal('chicken-rice-skillet', 'Chicken Brown Rice Skillet', 'dinner', 2, [{ ingredientId: 'chicken-breast', grams: 300 }, { ingredientId: 'brown-rice', grams: 320 }, { ingredientId: 'zucchini', grams: 200 }, { ingredientId: 'bell-pepper', grams: 160 }, { ingredientId: 'olive-oil', grams: 10 }], ['Cook diced chicken in half the oil until the thickest pieces reach 165°F.', 'Add zucchini and pepper and cook until tender-crisp.', 'Fold in ready-to-eat cooked rice, warm through, and divide into the required servings.'], 12, 18, ['high_protein'], '/images/foods/chicken-thigh.webp'),
  meal('beef-quinoa-vegetable-bowl', 'Beef Quinoa Vegetable Bowl', 'dinner', 2, [{ ingredientId: 'beef', grams: 300 }, { ingredientId: 'quinoa', grams: 300 }, { ingredientId: 'broccoli', grams: 180 }, { ingredientId: 'bell-pepper', grams: 160 }, { ingredientId: 'olive-oil', grams: 10 }], ['Sear the intact lean steak until its thickest part reaches 145°F, then rest it for 3 minutes before slicing.', 'Steam broccoli and warm pepper briefly in the pan.', 'Divide ready-to-eat cooked quinoa, vegetables, beef, and oil between bowls.'], 12, 18, ['high_protein'], '/images/foods/ribeye-steak.webp'),
  meal('turkey-bean-sweet-potato-skillet', 'Turkey, Black Bean & Sweet Potato Skillet', 'dinner', 2, [{ ingredientId: 'turkey-breast', grams: 260 }, { ingredientId: 'black-beans', grams: 260 }, { ingredientId: 'sweet-potato', grams: 300 }, { ingredientId: 'spinach', grams: 80 }, { ingredientId: 'olive-oil', grams: 10 }], ['Steam diced sweet potato until tender.', 'Warm turkey, beans, and oil in a skillet.', 'Fold in sweet potato and spinach until spinach wilts; divide into the required servings.'], 12, 15, ['high_protein'], '/images/foods/black-beans.webp'),
  meal('greek-yogurt-berry-crunch', 'Greek Yogurt Berry Crunch', 'snacks', 1, [{ ingredientId: 'greek-yogurt', grams: 220 }, { ingredientId: 'blueberries', grams: 100 }, { ingredientId: 'almonds', grams: 18 }, { ingredientId: 'chia-seeds', grams: 10 }], ['Spoon yogurt into a bowl.', 'Top with blueberries, almonds, and chia.', 'Eat immediately or chill up to one day.'], 5, 0, ['vegetarian', 'high_protein'], '/images/foods/greek-yogurt.webp'),
  meal('avocado-rice-cakes', 'Avocado Rice Cakes', 'snacks', 1, [{ ingredientId: 'rice-cake', grams: 36 }, { ingredientId: 'avocado', grams: 70 }, { ingredientId: 'cucumber', grams: 60 }, { ingredientId: 'lemon-juice', grams: 10 }], ['Mash avocado with lemon juice.', 'Spread across rice cakes.', 'Top with sliced cucumber and eat promptly.'], 8, 0, ['vegetarian', 'plant_based'], '/images/foods/rice-cakes.webp'),
  meal('peanut-banana-rice-cakes', 'Peanut Banana Rice Cakes', 'snacks', 1, [{ ingredientId: 'rice-cake', grams: 36 }, { ingredientId: 'peanut-butter', grams: 30 }, { ingredientId: 'banana', grams: 100 }, { ingredientId: 'chia-seeds', grams: 8 }], ['Spread peanut butter over rice cakes.', 'Top with sliced banana and chia.', 'Serve immediately.'], 5, 0, ['vegetarian', 'plant_based'], '/images/foods/rice-cakes.webp'),
  meal('tofu-crunch-box', 'Tofu Crunch Box', 'snacks', 2, [{ ingredientId: 'tofu', grams: 240 }, { ingredientId: 'cucumber', grams: 180 }, { ingredientId: 'bell-pepper', grams: 140 }, { ingredientId: 'olive-oil', grams: 8 }], ['Pat tofu dry and cut into cubes.', 'Brown tofu in a skillet with oil until warm and lightly crisp.', 'Divide tofu, cucumber, and pepper into the required snack boxes.'], 10, 12, ['vegetarian', 'plant_based', 'high_protein'], '/images/foods/tofu.webp'),
];

export const RECIPE_MEAL_BY_ID = Object.fromEntries(RECIPE_MEALS.map((item) => [item.id, item])) as Record<string, RecipeMeal>;
export const RECIPE_MEAL_WINDOWS: MealWindow[] = ['breakfast', 'lunch', 'dinner', 'snacks'];
export const RECIPE_MEAL_LABELS: Record<MealWindow, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snacks: 'Snack' };

function rounded(value: number, places = 1): number { const factor = 10 ** places; return Math.round(value * factor) / factor; }

export function recipeNutrition(recipe: RecipeMeal, servings = 1): RecipeNutrition {
  const scale = servings / recipe.yieldServings;
  return recipe.ingredients.reduce<RecipeNutrition>((totals, amount) => {
    const source = RECIPE_INGREDIENT_BY_ID[amount.ingredientId];
    if (!source) return totals;
    return {
      calories: totals.calories + source.nutritionPerGram.calories * amount.grams * scale,
      proteinGrams: totals.proteinGrams + source.nutritionPerGram.proteinGrams * amount.grams * scale,
      carbGrams: totals.carbGrams + source.nutritionPerGram.carbGrams * amount.grams * scale,
      fatGrams: totals.fatGrams + source.nutritionPerGram.fatGrams * amount.grams * scale,
    };
  }, { calories: 0, proteinGrams: 0, carbGrams: 0, fatGrams: 0 });
}

export function recipeCost(recipe: RecipeMeal, servings = 1): number {
  const scale = servings / recipe.yieldServings;
  return recipe.ingredients.reduce((total, amount) => total + (RECIPE_INGREDIENT_BY_ID[amount.ingredientId]?.illustrativePricePerGramUsd ?? 0) * amount.grams * scale, 0);
}

export function recipeIngredientQuantities(recipe: RecipeMeal, servings = 1): Array<RecipeIngredientAmount & { ingredient: RecipeIngredient; costUsd: number }> {
  const scale = servings / recipe.yieldServings;
  return recipe.ingredients.flatMap((amount) => {
    const ingredient = RECIPE_INGREDIENT_BY_ID[amount.ingredientId];
    if (!ingredient) return [];
    const grams = amount.grams * scale;
    return [{ ...amount, grams, ingredient, costUsd: grams * ingredient.illustrativePricePerGramUsd }];
  });
}

export function recipeDescriptor(recipe: RecipeMeal) {
  return { name: recipe.name, ingredients: recipe.ingredients.map((amount) => RECIPE_INGREDIENT_BY_ID[amount.ingredientId]?.name ?? amount.ingredientId), allergens: recipe.dietaryFlags.allergens, dietaryFlags: recipe.dietaryFlags };
}

function profileRequires(recipe: RecipeMeal, profile: UserProfile): boolean {
  const normalized = profile.dietaryRestrictions.map((item) => item.trim().toLowerCase());
  if (normalized.some((item) => ['vegan', 'plant based', 'plant-based'].includes(item)) && !recipe.dietTags.includes('plant_based')) return true;
  if (normalized.some((item) => ['vegetarian', 'meatless'].includes(item)) && !recipe.dietTags.includes('vegetarian')) return true;
  return false;
}

export interface RecipeSafety {
  hardBlocked: boolean;
  reasons: string[];
  warnings: string[];
}

/**
 * Existing allergies/custom exclusions remain hard blocks. For auto planning we also
 * treat the profile's GI and spice warnings as protective hard guards, so the planner
 * does not quietly place a known trigger in a generated, swapped, or loaded week.
 */
export function recipeSafety(recipe: RecipeMeal, profile: UserProfile): RecipeSafety {
  const dietary = evaluateDietarySafety(recipeDescriptor(recipe), profile);
  const protectiveWarnings = dietary.warnings.filter((warning) => warning.severity === 'amber').map((warning) => warning.label);
  const profileRestriction = profileRequires(recipe, profile);
  return {
    hardBlocked: dietary.hardBlocked || protectiveWarnings.length > 0 || profileRestriction,
    reasons: [...dietary.hardBlockReasons, ...protectiveWarnings, ...(profileRestriction ? ['Does not match a dietary restriction in your profile.'] : [])],
    warnings: dietary.warnings.map((warning) => warning.label),
  };
}

export function recipeMatchesPreferences(recipe: RecipeMeal, preferences: RecipeWeekPreferences): boolean {
  if (recipe.prepMinutes + recipe.cookMinutes > preferences.maxTotalMinutes) return false;
  if (preferences.diet === 'balanced') return true;
  return recipe.dietTags.includes(preferences.diet);
}

export function safeRecipeCandidates(profile: UserProfile, preferences: RecipeWeekPreferences, mealWindow?: MealWindow): RecipeMeal[] {
  return RECIPE_MEALS.filter((recipe) => (!mealWindow || recipe.mealWindow === mealWindow) && recipeMatchesPreferences(recipe, preferences) && !recipeSafety(recipe, profile).hardBlocked);
}

function seedNumber(seed: number | undefined, startDateKey: DateKey): number {
  if (Number.isInteger(seed)) return Math.abs(seed as number);
  return startDateKey.split('').reduce((total, character) => total + character.charCodeAt(0), 0);
}

function validSlot(slot: RecipeWeekSlot): boolean {
  return Number.isInteger(slot.day) && slot.day >= 1 && slot.day <= 7 && RECIPE_MEAL_WINDOWS.includes(slot.mealWindow) && Boolean(RECIPE_MEAL_BY_ID[slot.recipeId]) && Number.isFinite(slot.servings) && slot.servings > 0 && slot.servings <= 100;
}

export interface CreateRecipeWeekOptions { seed?: number; existingSlots?: RecipeWeekSlot[]; preserveExisting?: boolean; id?: string; now?: string; }

/** Creates 28 slots when a safe choice exists, otherwise intentionally leaves a visible gap. */
export function createRecipeWeekPlan(profile: UserProfile, preferences: RecipeWeekPreferences, options: CreateRecipeWeekOptions = {}): RecipeWeekPlan {
  const seed = seedNumber(options.seed, preferences.startDateKey);
  const previous = new Map((options.existingSlots ?? []).filter(validSlot).map((slot) => [`${slot.day}:${slot.mealWindow}`, slot]));
  const slots: RecipeWeekSlot[] = [];
  for (let day = 1; day <= 7; day += 1) {
    RECIPE_MEAL_WINDOWS.forEach((mealWindow, windowIndex) => {
      const candidates = safeRecipeCandidates(profile, preferences, mealWindow);
      const stored = previous.get(`${day}:${mealWindow}`);
      const existingRecipe = stored ? RECIPE_MEAL_BY_ID[stored.recipeId] : undefined;
      if (options.preserveExisting && stored && existingRecipe && candidates.some((candidate) => candidate.id === stored.recipeId)) {
        slots.push({ ...stored });
      } else if (candidates.length) {
        const chosen = candidates[(seed + day * 3 + windowIndex * 5) % candidates.length];
        slots.push({ day, mealWindow, recipeId: chosen.id, servings: 1 });
      }
    });
  }
  const now = options.now ?? new Date().toISOString();
  return { id: options.id ?? `recipe-week-${preferences.startDateKey}-${seed}-${now.slice(0, 10)}`, startDateKey: preferences.startDateKey, preferences, slots, createdAt: now, updatedAt: now };
}

/** Rechecks every persisted choice against the current profile and saved filters. */
export function reconcileRecipeWeekPlan(plan: RecipeWeekPlan, profile: UserProfile, now = new Date().toISOString()): RecipeWeekPlan {
  return createRecipeWeekPlan(profile, plan.preferences, { existingSlots: plan.slots, preserveExisting: true, id: plan.id, seed: seedNumber(undefined, plan.startDateKey), now: plan.createdAt || now });
}

/** Never present/export a choice newly blocked by the current profile; leave a visible gap. */
export function allowedRecipeWeekPlan(plan: RecipeWeekPlan, profile: UserProfile): RecipeWeekPlan {
  const allowed = new Set(safeRecipeCandidates(profile, plan.preferences).map((recipe) => recipe.id));
  return { ...plan, slots: plan.slots.filter((slot) => validSlot(slot) && allowed.has(slot.recipeId) && RECIPE_MEAL_BY_ID[slot.recipeId].mealWindow === slot.mealWindow) };
}

export interface RecipeGroceryItem {
  ingredient: RecipeIngredient;
  grams: number;
  costUsd: number;
  nutrition: RecipeNutrition;
}

export function aggregateRecipeIngredients(slots: RecipeWeekSlot[], householdSize = 1): RecipeGroceryItem[] {
  if (!Number.isInteger(householdSize) || householdSize < 1 || householdSize > 20) throw new Error('Household size must be a whole number from 1 to 20.');
  const totals = new Map<string, RecipeGroceryItem>();
  slots.filter(validSlot).forEach((slot) => {
    const recipe = RECIPE_MEAL_BY_ID[slot.recipeId];
    if (!recipe) return;
    recipeIngredientQuantities(recipe, slot.servings * householdSize).forEach((quantity) => {
      const current = totals.get(quantity.ingredient.id) ?? { ingredient: quantity.ingredient, grams: 0, costUsd: 0, nutrition: { calories: 0, proteinGrams: 0, carbGrams: 0, fatGrams: 0 } };
      current.grams += quantity.grams;
      current.costUsd += quantity.costUsd;
      current.nutrition.calories += quantity.ingredient.nutritionPerGram.calories * quantity.grams;
      current.nutrition.proteinGrams += quantity.ingredient.nutritionPerGram.proteinGrams * quantity.grams;
      current.nutrition.carbGrams += quantity.ingredient.nutritionPerGram.carbGrams * quantity.grams;
      current.nutrition.fatGrams += quantity.ingredient.nutritionPerGram.fatGrams * quantity.grams;
      totals.set(quantity.ingredient.id, current);
    });
  });
  return [...totals.values()].sort((left, right) => left.ingredient.aisle.localeCompare(right.ingredient.aisle) || left.ingredient.name.localeCompare(right.ingredient.name));
}

export interface RecipePrepBatch { recipe: RecipeMeal; servings: number; dates: DateKey[]; prepMinutes: number; cookMinutes: number; }
export function aggregateRecipePrep(slots: RecipeWeekSlot[], startDateKey: DateKey, householdSize = 1): RecipePrepBatch[] {
  if (!Number.isInteger(householdSize) || householdSize < 1 || householdSize > 20) throw new Error('Household size must be a whole number from 1 to 20.');
  const batches = new Map<string, RecipePrepBatch>();
  slots.filter(validSlot).forEach((slot) => {
    const recipe = RECIPE_MEAL_BY_ID[slot.recipeId];
    if (!recipe) return;
    const current = batches.get(recipe.id) ?? { recipe, servings: 0, dates: [], prepMinutes: recipe.prepMinutes, cookMinutes: recipe.cookMinutes };
    current.servings += slot.servings * householdSize;
    const date = addDays(startDateKey, slot.day - 1);
    if (!current.dates.includes(date)) current.dates.push(date);
    batches.set(recipe.id, current);
  });
  return [...batches.values()].sort((left, right) => left.recipe.name.localeCompare(right.recipe.name));
}

export function recipeWeekNutrition(slots: RecipeWeekSlot[]): RecipeNutrition {
  return slots.filter(validSlot).reduce<RecipeNutrition>((totals, slot) => {
    const nutrition = recipeNutrition(RECIPE_MEAL_BY_ID[slot.recipeId], slot.servings);
    return { calories: totals.calories + nutrition.calories, proteinGrams: totals.proteinGrams + nutrition.proteinGrams, carbGrams: totals.carbGrams + nutrition.carbGrams, fatGrams: totals.fatGrams + nutrition.fatGrams };
  }, { calories: 0, proteinGrams: 0, carbGrams: 0, fatGrams: 0 });
}

export function recipeWeekScope(plan: RecipeWeekPlan, householdSize: number): string {
  const slots = [...plan.slots].sort((left, right) => left.day - right.day || left.mealWindow.localeCompare(right.mealWindow)).map((slot) => `${slot.day}:${slot.mealWindow}:${slot.recipeId}:${slot.servings}`).join('|');
  // Two independent 32-bit accumulators retain selection identity without huge storage keys.
  let left = 2166136261; let right = 5381;
  for (let index = 0; index < slots.length; index += 1) { left = Math.imul(left ^ slots.charCodeAt(index), 16777619); right = Math.imul(right, 33) ^ slots.charCodeAt(index); }
  return `recipe-week:${plan.startDateKey}:h${householdSize}:${(left >>> 0).toString(16)}-${(right >>> 0).toString(16)}`;
}

export function recipeWeekCsv(plan: RecipeWeekPlan): string {
  const rows: Array<Array<string | number>> = [['Date', 'Day', 'Meal', 'Recipe', 'Personal servings', 'Calories estimate', 'Protein g', 'Carbs g', 'Fat g', 'Prep minutes', 'Cook minutes']];
  plan.slots.filter(validSlot).sort((left, right) => left.day - right.day || left.mealWindow.localeCompare(right.mealWindow)).forEach((slot) => {
    const recipe = RECIPE_MEAL_BY_ID[slot.recipeId]; const nutrition = recipeNutrition(recipe, slot.servings);
    rows.push([addDays(plan.startDateKey, slot.day - 1), slot.day, RECIPE_MEAL_LABELS[slot.mealWindow], recipe.name, slot.servings, rounded(nutrition.calories), rounded(nutrition.proteinGrams), rounded(nutrition.carbGrams), rounded(nutrition.fatGrams), recipe.prepMinutes, recipe.cookMinutes]);
  });
  return toCsv(rows);
}

export function recipeGroceryCsv(plan: RecipeWeekPlan, householdSize: number): string {
  const rows: Array<Array<string | number>> = [['Aisle', 'Ingredient', 'Measured state', 'Quantity g', 'Illustrative $/g', 'Illustrative cost USD']];
  aggregateRecipeIngredients(plan.slots, householdSize).forEach((item) => rows.push([item.ingredient.aisle, item.ingredient.name, item.ingredient.measuredAs, rounded(item.grams), item.ingredient.illustrativePricePerGramUsd.toFixed(3), item.costUsd.toFixed(2)]));
  return toCsv(rows);
}

export function recipePrepCsv(plan: RecipeWeekPlan, householdSize: number): string {
  const rows: Array<Array<string | number>> = [['Recipe', 'Household servings', 'Use dates', 'Prep minutes', 'Cook minutes']];
  aggregateRecipePrep(plan.slots, plan.startDateKey, householdSize).forEach((item) => rows.push([item.recipe.name, rounded(item.servings), item.dates.join('; '), item.prepMinutes, item.cookMinutes]));
  return toCsv(rows);
}
