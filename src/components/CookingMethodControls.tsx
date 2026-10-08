'use client';

import { calculateAddedOilCalories, requiresOilInput } from '@/lib/fitnessMealPlanner';
import type { CookingMethod, CookingOption, OilType } from '@/lib/fitnessMealPlanner';
import { formatLabel } from '@/lib/format';

const OIL_TYPES: OilType[] = ['olive_oil', 'butter', 'coconut_oil', 'avocado_oil'];

interface CookingMethodControlsProps {
  cookingOptions: CookingOption[];
  method: CookingMethod;
  onMethodChange: (method: CookingMethod) => void;
  oilType: OilType;
  onOilTypeChange: (oilType: OilType) => void;
  oilAmount: number;
  onOilAmountChange: (amount: number) => void;
  oilUnit: 'tbsp' | 'tsp';
  onOilUnitChange: (unit: 'tbsp' | 'tsp') => void;
  /** Prefixes input ids when more than one meal card is visible. */
  idPrefix?: string;
  compact?: boolean;
}

export default function CookingMethodControls({
  cookingOptions,
  method,
  onMethodChange,
  oilType,
  onOilTypeChange,
  oilAmount,
  onOilAmountChange,
  oilUnit,
  onOilUnitChange,
  idPrefix = 'cooking-method',
  compact = false,
}: CookingMethodControlsProps) {
  const selectedOption = cookingOptions.find((option) => option.method === method) ?? cookingOptions[0];
  const showOilInput = requiresOilInput(method);
  const oilOutsideRange = !Number.isFinite(oilAmount) || oilAmount < 0 || oilAmount > 32;
  const safeOilAmount = Number.isFinite(oilAmount) ? Math.min(32, Math.max(0, oilAmount)) : 0;
  const oilPreview = showOilInput ? calculateAddedOilCalories(oilType, safeOilAmount, oilUnit) : null;
  const selectClasses = compact ? 'input py-1 text-xs' : 'input';
  const methodId = `${idPrefix}-method`;
  const oilTypeId = `${idPrefix}-oil-type`;
  const oilAmountId = `${idPrefix}-oil-amount`;
  const oilUnitId = `${idPrefix}-oil-unit`;
  const oilPreviewId = `${idPrefix}-oil-preview`;

  const updateOilAmount = (value: string) => {
    const parsed = Number(value);
    // A numeric input can transiently be blank while edited. Keep the calculation
    // safe and let the displayed zero make the current committed value explicit.
    onOilAmountChange(Number.isFinite(parsed) ? Math.min(32, Math.max(0, parsed)) : 0);
  };

  return (
    <div className="space-y-2">
      <div>
        <label htmlFor={methodId} className="sr-only">Cooking method</label>
        <select
          id={methodId}
          value={method}
          onChange={(event) => onMethodChange(event.target.value as CookingMethod)}
          className={selectClasses}
        >
          {cookingOptions.map((option) => (
            <option key={option.method} value={option.method}>
              {formatLabel(option.method)}
            </option>
          ))}
        </select>
      </div>

      {selectedOption && (
        <p className="text-xs text-slate-400">
          Prep {selectedOption.prepTimeMinutes}m · Cook {selectedOption.cookTimeMinutes}m
          {selectedOption.recommendedTempF ? ` · ${selectedOption.recommendedTempF}°F` : ''}
          {selectedOption.cookingTip ? ` — ${selectedOption.cookingTip}` : ''}
        </p>
      )}

      {showOilInput && (
        <div className="rounded-lg bg-white/5 p-2">
          <p className="mb-2 text-xs text-slate-400">Enter oil per listed serving (0–32 in the selected unit). Planned servings scale this amount too; no preset cooking oil is counted.</p>
          {oilOutsideRange && <p role="alert" className="mb-2 text-xs text-accent-amber">The stored oil amount is outside the supported range. This preview is bounded; the saved entry is unchanged until you edit it.</p>}
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={oilTypeId} className="sr-only">Oil type</label>
            <select
              id={oilTypeId}
              value={oilType}
              onChange={(event) => onOilTypeChange(event.target.value as OilType)}
              className="input w-auto py-1 text-xs"
            >
              {OIL_TYPES.map((type) => (
                <option key={type} value={type}>
                  {formatLabel(type)}
                </option>
              ))}
            </select>
            <label htmlFor={oilAmountId} className="sr-only">Oil amount</label>
            <input
              id={oilAmountId}
              aria-describedby={oilPreviewId}
              aria-label="Oil amount"
              type="number"
              min={0}
              max={32}
              step={0.5}
              value={safeOilAmount}
              onChange={(event) => updateOilAmount(event.target.value)}
              className="input w-16 py-1 text-xs"
            />
            <label htmlFor={oilUnitId} className="sr-only">Oil unit</label>
            <select
              id={oilUnitId}
              value={oilUnit}
              onChange={(event) => onOilUnitChange(event.target.value as 'tbsp' | 'tsp')}
              className="input w-auto py-1 text-xs"
            >
              <option value="tbsp">tbsp</option>
              <option value="tsp">tsp</option>
            </select>
            {oilPreview && (
              <span id={oilPreviewId} className="text-xs font-semibold text-accent-amber" aria-live="polite">
                +{oilPreview.addedCalories} kcal · +{oilPreview.addedFatGrams}g fat
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
