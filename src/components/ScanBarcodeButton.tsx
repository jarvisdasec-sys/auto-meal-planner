'use client';

import { useCallback, useState } from 'react';
import { useMealPlannerStore } from '@/store/useMealPlannerStore';
import { isValidBarcode, lookupProductByBarcode } from '@/lib/openFoodFacts';
import { buildStorePrices } from '@/lib/stores';
import type { CatalogFoodItem } from '@/lib/foodCatalog';
import type { StoreName } from '@/lib/fitnessMealPlanner';
import BarcodeScannerModal from './BarcodeScannerModal';
import CustomFoodModal, { type CustomFoodInput } from './CustomFoodModal';

type Status = { kind: 'success' | 'error' | 'info'; message: string } | null;

function unknownPriceAvailability(): Partial<Record<StoreName, boolean>> {
  return Object.fromEntries(Object.keys(buildStorePrices(0)).map((store) => [store, false])) as Partial<Record<StoreName, boolean>>;
}

function unknownDietaryTags() {
  return {
    allergens: [],
    isHighFodmap: false,
    isGerdTrigger: false,
    containsGluten: false,
    containsLactose: false,
    spiceLevel: 'none' as const,
  };
}

function formatError(cause: unknown, fallback: string): string {
  return cause instanceof Error ? cause.message : fallback;
}

export default function ScanBarcodeButton() {
  const foodCatalog = useMealPlannerStore((s) => s.foodCatalog);
  const logFood = useMealPlannerStore((s) => s.logFood);
  const addCustomFood = useMealPlannerStore((s) => s.addCustomFood);
  const addSavedRecipe = useMealPlannerStore((s) => s.addSavedRecipe);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [customFoodOpen, setCustomFoodOpen] = useState(false);
  const [pendingBarcode, setPendingBarcode] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const handleCameraUnavailable = useCallback((message: string) => setStatus({ kind: 'error', message }), []);

  const handleLookup = useCallback(async (rawBarcode: string) => {
    const barcode = rawBarcode.trim();
    if (!isValidBarcode(barcode)) {
      setStatus({ kind: 'error', message: 'Enter an 8–14 digit UPC or EAN barcode before looking it up.' });
      return;
    }
    if (isLookingUp) return;
    setScannerOpen(false);
    setStatus({ kind: 'info', message: 'Looking up product…' });
    setIsLookingUp(true);

    try {
      const existing = foodCatalog.find((food) => food.barcode === barcode);
      if (existing) {
        logFood(existing.id, existing.name, existing.caloriesRaw, 'raw', 'raw', undefined, 'snacks', undefined, {
          servings: 1,
          portion: existing.portionRaw,
          imageUrl: existing.imageUrl,
          ingredients: existing.ingredients,
          allergens: existing.dietaryTags.allergens,
          dietaryFlags: existing.dietaryTags,
          source: 'barcode_catalog',
        });
        setStatus({ kind: 'success', message: `Logged ${existing.name} from your food catalog.` });
        return;
      }

      const result = await lookupProductByBarcode(barcode);
      if (result.status === 'not_found') {
        setPendingBarcode(barcode);
        setCustomFoodOpen(true);
        setStatus({ kind: 'info', message: 'This barcode was not found in Open Food Facts. Add the label details manually instead.' });
        return;
      }
      if (result.status === 'failed') {
        setStatus({ kind: 'error', message: result.message });
        return;
      }

      const { product } = result;
      const nutrition = product.nutrition;
      const newFood: CatalogFoodItem = {
        id: `off-${barcode}`,
        barcode,
        name: product.name,
        category: 'snack',
        portionRaw: nutrition.label,
        caloriesRaw: nutrition.calories,
        portionCooked: nutrition.label,
        caloriesCooked: nutrition.calories,
        proteinGrams: nutrition.proteinGrams,
        carbGrams: nutrition.carbGrams,
        fatGrams: nutrition.fatGrams,
        snackProfile: [],
        estimatedPrices: buildStorePrices(0),
        priceAvailability: unknownPriceAvailability(),
        imageUrl: product.imageUrl,
        ingredients: product.ingredients,
        dietaryTags: { ...unknownDietaryTags(), allergens: product.allergens ?? [] },
        cookingOptions: [{ method: 'raw', prepTimeMinutes: 0, cookTimeMinutes: 0, macroMultiplier: { calories: 1, protein: 1, carbs: 1, fat: 1 } }],
        mealWindows: ['snacks'],
      };
      addCustomFood(newFood);
      // Log as a supplied label snapshot rather than relying on placeholder dietary
      // flags in a catalog shape. This lets the shared evaluator label missing label
      // facts as unverified and retains the exact OFF serving/100 g basis.
      logFood(
        `barcode-log-${barcode}-${crypto.randomUUID()}`,
        product.name,
        nutrition.calories,
        'raw',
        'raw',
        undefined,
        'snacks',
        { proteinGrams: nutrition.proteinGrams, carbGrams: nutrition.carbGrams, fatGrams: nutrition.fatGrams },
        {
          servings: 1,
          nutritionIsPerServing: true,
          portion: nutrition.label,
          imageUrl: product.imageUrl,
          ingredients: product.ingredients,
          allergens: product.allergens,
          source: 'barcode_open_food_facts',
        },
      );
      setStatus({ kind: 'success', message: `Logged ${newFood.name} using Open Food Facts nutrition for ${nutrition.label}. Price is unknown until you add an estimate.` });
    } catch (cause) {
      setStatus({ kind: 'error', message: formatError(cause, 'Unable to log this barcode. Please try again or add it manually.') });
    } finally {
      setIsLookingUp(false);
    }
  }, [addCustomFood, foodCatalog, isLookingUp, logFood]);

  const handleCustomFoodSave = (input: CustomFoodInput) => {
    const servings = input.servings ?? 1;
    try {
      if (input.saveToCatalog) {
        const newFood: CatalogFoodItem = {
          id: `custom-${crypto.randomUUID()}`,
          barcode: pendingBarcode ?? '',
          name: input.name,
          category: input.category,
          portionRaw: '1 serving',
          caloriesRaw: input.calories,
          portionCooked: '1 serving',
          caloriesCooked: input.calories,
          proteinGrams: input.proteinGrams,
          carbGrams: input.carbGrams,
          fatGrams: input.fatGrams,
          snackProfile: [],
          estimatedPrices: buildStorePrices(0),
          priceAvailability: unknownPriceAvailability(),
          cookingOptions: [{ method: 'raw', prepTimeMinutes: 0, cookTimeMinutes: 0, macroMultiplier: { calories: 1, protein: 1, carbs: 1, fat: 1 } }],
          dietaryTags: unknownDietaryTags(),
          mealWindows: [input.mealWindow],
        };
        addCustomFood(newFood);
        addSavedRecipe({
          id: `recipe-${newFood.id}`,
          foodId: newFood.id,
          name: newFood.name,
          calories: newFood.caloriesRaw,
          proteinGrams: newFood.proteinGrams,
          carbGrams: newFood.carbGrams,
          fatGrams: newFood.fatGrams,
          mealWindow: input.mealWindow,
          servings: 1,
        });
      }
      // Keep custom nutrition as one per-serving snapshot and apply the multiplier
      // exactly once in the shared logger, whether or not it is also catalogued.
      logFood(
        `quick-${crypto.randomUUID()}`,
        input.name,
        input.calories,
        'raw',
        'raw',
        undefined,
        input.mealWindow,
        { proteinGrams: input.proteinGrams, carbGrams: input.carbGrams, fatGrams: input.fatGrams },
        {
          servings,
          nutritionIsPerServing: input.nutritionIsPerServing ?? true,
          portion: `${servings} serving${servings === 1 ? '' : 's'}`,
          source: pendingBarcode ? 'barcode_custom' : 'custom',
        },
      );
      setStatus({ kind: 'success', message: `Logged ${input.name} (${servings} serving${servings === 1 ? '' : 's'}). Price is unknown until you add an estimate.` });
      setPendingBarcode(null);
    } catch (cause) {
      setStatus({ kind: 'error', message: formatError(cause, 'Unable to log this custom food. Please check the details and try again.') });
      throw cause;
    }
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => { setStatus(null); setScannerOpen(true); }}
          disabled={isLookingUp}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLookingUp ? 'Looking up…' : 'Scan Barcode'}
        </button>
        <button
          onClick={() => { setPendingBarcode(null); setCustomFoodOpen(true); }}
          className="rounded-lg bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/10"
        >
          + Add Custom Food
        </button>
      </div>
      {status && <p role={status.kind === 'error' ? 'alert' : 'status'} className={`text-xs ${status.kind === 'error' ? 'text-accent-red' : status.kind === 'success' ? 'text-accent-green' : 'text-slate-400'}`}>{status.message}</p>}

      <BarcodeScannerModal
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={handleLookup}
        onManualLookup={handleLookup}
        onCameraUnavailable={handleCameraUnavailable}
      />
      <CustomFoodModal
        open={customFoodOpen}
        barcode={pendingBarcode}
        onClose={() => { setCustomFoodOpen(false); setPendingBarcode(null); }}
        onSave={handleCustomFoodSave}
      />
    </div>
  );
}
