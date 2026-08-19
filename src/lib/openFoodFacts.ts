export interface OpenFoodFactsProduct {
  barcode: string;
  name: string;
  caloriesPer100g: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
  imageUrl?: string;
}

/**
 * Look up a product by barcode via the Open Food Facts API.
 * Returns null when the product is not found or the lookup fails.
 */
export async function fetchProductByBarcode(barcode: string): Promise<OpenFoodFactsProduct | null> {
  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);
    if (!response.ok) return null;

    const data = await response.json();
    if (data.status !== 1 || !data.product) return null;

    const product = data.product;
    const nutriments = product.nutriments ?? {};
    const name: string = product.product_name || product.generic_name || 'Unknown Product';

    return {
      barcode,
      name,
      caloriesPer100g: nutriments['energy-kcal_100g'] ?? nutriments['energy-kcal'] ?? 0,
      proteinGrams: nutriments['proteins_100g'] ?? 0,
      carbGrams: nutriments['carbohydrates_100g'] ?? 0,
      fatGrams: nutriments['fat_100g'] ?? 0,
      imageUrl: product.image_front_small_url,
    };
  } catch {
    return null;
  }
}
