# BTB complete-recipe client-growth release

## Implemented product

The new Recipe Week workspace contains 17 cookable recipes across breakfast, lunch, dinner and snacks. Every recipe has quantified ingredients, measured state, yield and instructions. Seven-day generation honors dietary preferences, active kitchen-time filters, existing profile allergens/custom exclusions and configured GI safeguards; unavailable choices leave visible gaps. It is a starting selection, not nutrition-target optimization or a personalized clinical plan.

Personal portions, safe swaps, meal locks, unlocked regeneration, favorites, named weeks and safe load are functional. Recipe shopping and batch preparation use the same ingredient quantities, scaled for the household only. Checklists persist under bounded selection-specific keys. Changed profile exclusions remove blocked choices from current views, shopping, prep and exports; replaced blocked meals do not keep old locks. Swaps retain personal servings. Logging happens only when a user presses Log consumed for their chosen local date; household quantities never enter the personal ledger.

There are week/shopping/prep CSV downloads and printable sheets. The full recipe printout includes all seven days rather than duplicating the active-day screen. Browser JSON backup includes the new recipe workspace alongside prior data. Corrupt recipe snapshots do not incorrectly imply browser storage is unavailable.

## Preservation

The existing original store key and profile, food catalog, individual-food week, logs, recipes, pantry, hydration/history and barcode/manual tools remain. The original week is labeled Food Week; its shopping/prep remain distinct from Recipe Week's ingredient workflow. The new store is separate, versioned and effect-hydrated to avoid SSR mismatches. The website CTA can open `?view=recipeWeek` without generating or overwriting a plan automatically.

## Product limits

Nutrition uses disclosed generic illustrative ingredient planning inputs, not a verified product/FoodData Central integration. Grocery prices are illustrative US price inputs—not retailer quotes or a budget guarantee. Existing images represent ingredients rather than exact plated meals or portions. Active times do not include overnight chilling or cooking grains from dry where ready-cooked ingredients are specified. Food handling guidance includes refrigeration within 2 hours (1 hour above 90°F), storage at 40°F or below for 3–4 days, freezing later portions or prepping again, and reheating cooked leftovers to 165°F. Review labels and cross-contact: filters do not guarantee allergy safety.

No cloud accounts/sync, live shared household editing, payment subscription, AI photo/voice logging, trainer monitoring or clinical-diet service was added. JSON export is not an import/restore interface. Commercial launch needs verified nutrition content, actual account/entitlement/billing architecture and reliable support/lead delivery.

## Review boundary

This upgrade is a GitHub feature-branch review, not a production publication. Owner approval is required before merging to the existing permanent Vercel site. Browser checks cover generation, meal locks, named save, household shopping/prep persistence, explicit dated personal logging, full-week print behavior and mobile overflow. Full checks are recorded with the release handoff.
