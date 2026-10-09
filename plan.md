# BTB Meal Planner — premium workspace upgrade

## Required outcome
Change the existing planner at https://auto-meal-planner-pi.vercel.app from “Fitness & Meal Planner” to **BTB Meal Planner**, match https://www.btbfitnessandhealth.com with neon green and black, and improve it into a professional meal-planning workspace including meal preparation. Preserve the existing application, local profile/plans/logs, GitHub repository and Vercel deployment.

## Implementation approach
Work from `jarvisdasec-sys/auto-meal-planner` main baseline `59bd8cc` on a feature branch. Retain the current Next.js/React/Zustand stack, locked dependencies, food catalog, nutrition ledger, dietary guards, daily planner, barcode/manual logger, recipes, history, pantry and existing image assets. No migration to another host or account service is needed. This external GitHub project has no managed project binding in this session; use the existing TypeScript check, lint, tests and production build rather than pretend host diagnostics ran.

Add a default Overview with real logged-vs-planned nutrition, weekly plan coverage, actionable shortcuts and hydration progress. Add a seven-day planning board using the same persisted plan, start-date selection, day-copy, serving adjustment, guarded replacement, realistic estimated totals, print and CSV export. Plan generation remains clearly labeled a starting selection, not a guarantee that calorie/macro goals are met.

Add a dedicated Meal Prep workspace generated from resolved plan slots. Aggregate actual serving quantities, scale prep and groceries by household size without multiplying the user's nutrition log, show prep/cook estimates as estimates, offer plan-specific completion checklists, prep dates and notes, and print a prep sheet. Include authoritative food storage and reheating guidance with links; do not imply a whole week's cooked food is safe to refrigerate indefinitely. Preparation records must be scoped to current plan/servings, not reused across unrelated regenerated plans.

Add a household/budget shopping workspace with durable checked states, aisle grouping, pantry subtraction, explicit missing-price status, budget variance and printable/exportable lists. Exclude recorded expired inventory from available pantry portions and flag it. Purchase checkmarks do not silently change pantry inventory.

Retain existing Recipe Box and add a validated recipe builder with servings, per-serving nutrition, ingredients, instructions, meal window and allergen flags. Saving a recipe must use the existing store contract and must not invent measured nutrition or ingredient prices.

Add Backup & Export with browser-local data export and CSV history export. State clearly that there is no account/cloud sync. Existing primary storage key remains unchanged; new workspace preferences/checklist data use a separate versioned key and guarded client hydration.

## Design
- **Movement:** BTB industrial performance editorial, consistent with the reference site's black canvas and electric-green wayfinding.
- **Principles:** readable contrast; purposeful hierarchy; operational clarity; restrained visual effects.
- **Palette:** true/near black base, charcoal cards, neutral gray dividers and text, verified website neon green `#8CFF00`; amber/red remain semantic warning/error colors. Neon buttons use black text, not white-on-lime.
- **Layout:** fixed narrow left navigation on desktop, scrollable compact navigation on mobile, editorial page heading, asymmetric Overview with a primary nutrition panel and an action rail. Existing tool content is kept inside the new shell.
- **Signature elements:** thin neon rule, small uppercase mono section labels, numbered workflow stages, compact status chips.
- **Interaction:** every shortcut navigates to the real tool; controls are labeled and keyboard accessible; validation and empty states are explicit.
- **Animation:** short opacity/color transitions only, honor reduced motion; no decorative looping animations.
- **Typography:** website-matched Barlow body, Oswald headings, and JetBrains Mono operational labels, with browser-safe fallback stacks.
- **Brand essence:** BTB Meal Planner helps people turn nutrition intent into a repeatable kitchen routine. Precise, disciplined, supportive.
- **Voice:** direct, useful, no unsupported premium subscription or coaching claims. Examples: “Plan the week. Prep with purpose.” and “Your plan is a starting point. Make it yours.”
- **Mark:** reuse BTB identity from the reference when technically available, otherwise a typographic BTB wordmark as application UI; no generated food photos are needed.
- **Signature color:** website's neon green; black and neutral surfaces own the background.

## Project structure
`app/` owns the dashboard route, layout/metadata, CSS and image API. `src/components/Dashboard.tsx` owns navigation and the premium shell. New focused components own Overview, WeeklyPlanner, MealPrepHub, WorkspaceSettings and RecipeBuilder. Existing tool components remain available. `src/store/useMealPlannerStore.ts` stays the primary state boundary; `src/store/useWorkspaceStore.ts` owns only new preferences/checklists and hydration. `src/lib/` contains pure plan/prep/export helpers and existing safety/calculation contracts. `tests/` and module tests cover new behavior. `public/` holds existing accurate images and updated icon/manifest/routes.

## Publication boundary
Create a tested pull request and review preview through the existing repository, without silently merging or publishing to production. Present the exact completed scope for approval before triggering the existing Vercel production deployment. Do not confuse preview verification with a live update.
