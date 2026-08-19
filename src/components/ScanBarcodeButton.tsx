'use client';

import { useCallback, useState } from 'react';
import { useMealPlannerStore } from '@/store/useMealPlannerStore';
import { fetchProductByBarcode } from '@/lib/openFoodFacts';
import type { CatalogFoodItem } from '@/lib/foodCatalog';
import BarcodeScannerModal from './BarcodeScannerModal';
import CustomFoodModal, { type CustomFoodInput } from './CustomFoodModal';

export default function ScanBarcodeButton() {
  const foodCatalog = useMealPlannerStore((s) => s.foodCatalog);
  const logFood = useMealPlannerStore((s) => s.logFood);
  const addCustomFood = useMealPlannerStore((s) => s.addCustomFood);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [customFoodOpen, setCustomFoodOpen] = useState(false);
  const [pendingBarcode, setPendingBarcode] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const handleDetected = useCallback(
    async (barcode: string) => {
      setScannerOpen(false);
      setStatus('Looking up product…');

      const existing = foodCatalog.find((food) => food.barcode === barcode);
      if (existing) {
        logFood(existing.id, existing.name, existing.caloriesRaw, 'raw');
        setStatus(`Logged ${existing.name} from catalog.`);
        return;
      }

      const product = await fetchProductByBarcode(barcode);
      if (!product) {
        setStatus(null);
        setPendingBarcode(barcode);
        setCustomFoodOpen(true);
        return;
      }

      const newFood: CatalogFoodItem = {
        id: `off-${barcode}`,
        barcode,
        name: product.name,
        category: 'snack',
        portionRaw: '100g',
        caloriesRaw: Math.round(product.caloriesPer100g),
        portionCooked: '100g',
        caloriesCooked: Math.round(product.caloriesPer100g),
        proteinGrams: product.proteinGrams,
        carbGrams: product.carbGrams,
        fatGrams: product.fatGrams,
        snackProfile: [],
        estimatedPrices: { walmart: 0, foodLion: 0, aldi: 0, kroger: 0 },
        mealWindows: ['snacks'],
      };
      addCustomFood(newFood);
      logFood(newFood.id, newFood.name, newFood.caloriesRaw, 'raw');
      setStatus(`Logged ${newFood.name} (${newFood.caloriesRaw} kcal) from Open Food Facts.`);
    },
    [foodCatalog, logFood, addCustomFood],
  );

  const handleCustomFoodSave = (input: CustomFoodInput) => {
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
        estimatedPrices: { walmart: 0, foodLion: 0, aldi: 0, kroger: 0 },
        mealWindows: [input.mealWindow],
      };
      addCustomFood(newFood);
      logFood(newFood.id, newFood.name, newFood.caloriesRaw, 'raw');
    } else {
      logFood(`quick-${crypto.randomUUID()}`, input.name, input.calories, 'raw');
    }
    setStatus(`Logged ${input.name} (${input.calories} kcal).`);
    setPendingBarcode(null);
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => {
            setStatus(null);
            setScannerOpen(true);
          }}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent/90"
        >
          Scan Barcode
        </button>
        <button
          onClick={() => {
            setPendingBarcode(null);
            setCustomFoodOpen(true);
          }}
          className="rounded-lg bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/10"
        >
          + Add Custom Food
        </button>
      </div>
      {status && <p className="text-xs text-slate-400">{status}</p>}

      <BarcodeScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={handleDetected} />
      <CustomFoodModal
        open={customFoodOpen}
        barcode={pendingBarcode}
        onClose={() => setCustomFoodOpen(false)}
        onSave={handleCustomFoodSave}
      />
    </div>
  );
}
