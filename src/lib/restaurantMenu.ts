export interface RestaurantMenuItem {
  id: string;
  name: string;
  calories: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
}

export interface RestaurantChain {
  id: string;
  name: string;
  items: RestaurantMenuItem[];
}

// Approximate, representative nutrition values for popular chain menu items (estimates for planning purposes)
export const RESTAURANT_CHAINS: RestaurantChain[] = [
  {
    id: 'chipotle',
    name: 'Chipotle',
    items: [
      { id: 'chipotle-chicken-bowl', name: 'Chicken Burrito Bowl (no rice, extra veggies)', calories: 555, proteinGrams: 45, carbGrams: 40, fatGrams: 20 },
      { id: 'chipotle-barbacoa-salad', name: 'Barbacoa Salad Bowl', calories: 620, proteinGrams: 40, carbGrams: 35, fatGrams: 30 },
      { id: 'chipotle-sofritas-bowl', name: 'Sofritas Bowl with Brown Rice', calories: 705, proteinGrams: 20, carbGrams: 90, fatGrams: 25 },
    ],
  },
  {
    id: 'subway',
    name: 'Subway',
    items: [
      { id: 'subway-turkey-6', name: '6" Turkey Breast on Wheat', calories: 280, proteinGrams: 18, carbGrams: 46, fatGrams: 3.5 },
      { id: 'subway-rotisserie-salad', name: 'Rotisserie Chicken Salad (no dressing)', calories: 220, proteinGrams: 27, carbGrams: 9, fatGrams: 8 },
      { id: 'subway-steak-footlong', name: 'Footlong Steak & Cheese', calories: 720, proteinGrams: 48, carbGrams: 84, fatGrams: 22 },
    ],
  },
  {
    id: 'chick-fil-a',
    name: "Chick-fil-A",
    items: [
      { id: 'cfa-grilled-sandwich', name: 'Grilled Chicken Sandwich', calories: 320, proteinGrams: 28, carbGrams: 41, fatGrams: 6 },
      { id: 'cfa-grilled-nuggets', name: 'Grilled Nuggets (12ct) + Fruit Cup', calories: 260, proteinGrams: 38, carbGrams: 16, fatGrams: 4 },
      { id: 'cfa-8ct-nuggets-fries', name: '8ct Nuggets + Waffle Fries', calories: 620, proteinGrams: 28, carbGrams: 60, fatGrams: 30 },
    ],
  },
  {
    id: 'panera',
    name: 'Panera Bread',
    items: [
      { id: 'panera-turkey-chili-bowl', name: 'Turkey Chili Bowl', calories: 340, proteinGrams: 27, carbGrams: 35, fatGrams: 10 },
      { id: 'panera-greek-salad-chicken', name: 'Greek Salad with Chicken', calories: 460, proteinGrams: 33, carbGrams: 18, fatGrams: 29 },
      { id: 'panera-mac-cheese', name: 'Mac & Cheese (bread bowl)', calories: 990, proteinGrams: 32, carbGrams: 110, fatGrams: 44 },
    ],
  },
  {
    id: 'mcdonalds',
    name: "McDonald's",
    items: [
      { id: 'mcd-grilled-mcchicken', name: 'Grilled Chicken Sandwich (no mayo)', calories: 350, proteinGrams: 27, carbGrams: 44, fatGrams: 7 },
      { id: 'mcd-side-salad', name: 'Side Salad with Grilled Chicken', calories: 200, proteinGrams: 22, carbGrams: 9, fatGrams: 8 },
      { id: 'mcd-big-mac-fries', name: 'Big Mac + Medium Fries', calories: 1090, proteinGrams: 28, carbGrams: 106, fatGrams: 60 },
    ],
  },
];

/**
 * Pick the menu item that best fits the remaining daily calories: the closest match that
 * doesn't exceed the remaining budget, or the smallest overage if everything exceeds it.
 */
export function findBestRestaurantChoice(
  items: RestaurantMenuItem[],
  remainingCalories: number,
): RestaurantMenuItem {
  const withinBudget = items.filter((item) => item.calories <= remainingCalories);
  const pool = withinBudget.length > 0 ? withinBudget : items;
  return pool.reduce((best, item) => {
    const bestDiff = Math.abs(remainingCalories - best.calories);
    const itemDiff = Math.abs(remainingCalories - item.calories);
    return itemDiff < bestDiff ? item : best;
  }, pool[0]);
}
