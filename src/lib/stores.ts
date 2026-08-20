import type { EstimatedPrices, StoreName } from './fitnessMealPlanner';

export const STORE_NAMES: StoreName[] = [
  'walmart',
  'kroger',
  'albertsons',
  'aldi',
  'costco',
  'wholeFoods',
  'traderJoes',
  'target',
  'samsClub',
  'publix',
];

export const STORE_LABELS: Record<StoreName, string> = {
  walmart: 'Walmart',
  kroger: 'Kroger',
  albertsons: 'Albertsons',
  aldi: 'Aldi',
  costco: 'Costco',
  wholeFoods: 'Whole Foods Market',
  traderJoes: "Trader Joe's",
  target: 'Target',
  samsClub: "Sam's Club",
  publix: 'Publix',
};

// Relative price multiplier vs. a baseline (Walmart = 1.0), used to derive
// per-store estimates from a single base price for each catalog item.
const STORE_PRICE_MULTIPLIERS: Record<StoreName, number> = {
  walmart: 1.0,
  kroger: 1.08,
  albertsons: 1.12,
  aldi: 0.85,
  costco: 0.8,
  wholeFoods: 1.35,
  traderJoes: 1.05,
  target: 1.1,
  samsClub: 0.82,
  publix: 1.15,
};

/**
 * Derive an estimated price at every supported store from a single base (Walmart) price.
 */
export function buildStorePrices(basePrice: number): EstimatedPrices {
  const prices = {} as EstimatedPrices;
  for (const store of STORE_NAMES) {
    prices[store] = Math.round(basePrice * STORE_PRICE_MULTIPLIERS[store] * 100) / 100;
  }
  return prices;
}
