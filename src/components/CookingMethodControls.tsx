'use client';

import { requiresOilInput, calculateAddedOilCalories } from '@/lib/fitnessMealPlanner';
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
  compact = false,
}: CookingMethodControlsProps) {
  const selectedOption = cookingOptions.find((option) => option.method === method) ?? cookingOptions[0];
  const showOilInput = requiresOilInput(method);
  const oilPreview = showOilInput ? calculateAddedOilCalories(oilType, oilAmount, oilUnit) : null;
  const selectClasses = compact ? 'input py-1 text-xs' : 'input';

  return (
    <div className="space-y-2">
      <select value={method} onChange={(e) => onMethodChange(e.target.value as CookingMethod)} className={selectClasses}>
        {cookingOptions.map((option) => (
          <option key={option.method} value={option.method}>
            {formatLabel(option.method)}
          </option>
        ))}
      </select>

      {selectedOption && (
        <p className="text-xs text-slate-400">
          Prep {selectedOption.prepTimeMinutes}m · Cook {selectedOption.cookTimeMinutes}m
          {selectedOption.recommendedTempF ? ` · ${selectedOption.recommendedTempF}°F` : ''}
          {selectedOption.cookingTip ? ` — ${selectedOption.cookingTip}` : ''}
        </p>
      )}

      {showOilInput && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-white/5 p-2">
          <select
            value={oilType}
            onChange={(e) => onOilTypeChange(e.target.value as OilType)}
            className="input w-auto py-1 text-xs"
          >
            {OIL_TYPES.map((type) => (
              <option key={type} value={type}>
                {formatLabel(type)}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            step={0.5}
            value={oilAmount}
            onChange={(e) => onOilAmountChange(Number(e.target.value))}
            className="input w-16 py-1 text-xs"
          />
          <select
            value={oilUnit}
            onChange={(e) => onOilUnitChange(e.target.value as 'tbsp' | 'tsp')}
            className="input w-auto py-1 text-xs"
          >
            <option value="tbsp">tbsp</option>
            <option value="tsp">tsp</option>
          </select>
          {oilPreview && (
            <span className="text-xs font-semibold text-accent-amber">
              +{oilPreview.addedCalories} kcal · +{oilPreview.addedFatGrams}g fat
            </span>
          )}
        </div>
      )}
    </div>
  );
}
