# BTB Meal Planner — premium workspace release candidate

This release updates the existing `jarvisdasec-sys/auto-meal-planner` application rather than replacing its host or rewriting its persistent data. It is prepared for review; production publication requires approval of the final pull-request revision.

## Delivered scope

| Area | Completed behavior |
| --- | --- |
| BTB identity | Homepage, metadata, mobile title, icon, manifest and route declaration use BTB Meal Planner. The palette matches the official website's `#8CFF00` neon green with black/charcoal surfaces. Barlow, Oswald and JetBrains Mono match its typography, with fallback stacks. |
| Professional Overview | Default operations dashboard shows actual logged intake, calorie/macro progress, hydration, saved recipes, weekly coverage, and real workflow shortcuts. Planned food is explicitly separate from consumed food. |
| Seven-day planner | Start-date selection, persisted generation, seven daily panels, guarded food replacement, personal serving controls, atomic day copy, CSV download and printable weekly plan. Estimates disclose gaps from the calorie target. |
| Meal preparation | Actual fractional serving sums, household scaling, plan-specific completion checklist, preparation date, session notes, catalog preparation/cooking estimates, printable prep sheet, usage dates, and later-week freezing/second-session guidance. |
| Household shopping | Aisle-grouped shopping list, pantry subtraction after household scaling, recorded expired-stock exclusion, persistent plan/quantity-scoped purchased checks, household/budget preferences, partial-price status, budget variance, CSV download and printing. Purchased checks do not invent pantry stock. |
| Recipe creation | Name, meal window, yield, cooking method, ingredients, instructions, known allergen flags and supplied calories/macros. Whole-batch nutrition divides by yield; saved nutrition is always per serving. Existing Recipe Box logging and plan insertion remain available. |
| Data control | Explicitly whitelisted browser-local JSON backup, dated food-history CSV, separate versioned workspace preferences, existing primary storage key and records retained. No cloud-account or automatic-sync claims. |
| Accessibility | High-contrast black text on neon action buttons, labeled inputs, keyboard focus, skip link, mobile scrolling navigation, reduced-motion support, and browser zoom allowed. |

## Verification

The original baseline had 75 passing tests. The upgraded release has **95 passing tests in 27 files**, including new pure-helper, component, workspace persistence and stable SSR-placeholder tests. TypeScript and lint are clean. The final production build passed after the timezone fix; local and public review URLs, BTB title, manifest, route declaration and icon returned HTTP 200. Production dependency audit reports zero vulnerabilities; nine existing development-tool advisories remain and no breaking dependency upgrades were made.

A read-only integration review confirmed the shared-plan and data-preservation flows and identified a timezone hydration mismatch risk. The final dashboard gates client-local dates and persisted-data panels until mount, with a regression confirming stable server-rendered placeholders. Recipe save warnings remain mounted and visible after save. All original food-image assets and provider/manual fallbacks are retained.

## Important boundaries

Automatic food selection is a starting plan, not a dietitian-authored balanced menu or a guarantee of reaching targets. Calorie/macronutrient, portion, preparation-time, and grocery values are estimates; larger batches may need longer preparation. Recipe ingredient text is not converted into invented grocery weights or prices. Household size is a multiplier for prep and shopping only, not nutrition logging.

[USDA leftover guidance](https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/leftovers-and-food-safety) is linked in Meal Prep. Refrigerate perishables promptly (two hours, or one above 90°F), store cooked leftovers at 40°F or below for three to four days, freeze later-week portions or prepare another session, and reheat leftovers to 165°F with a thermometer. These are general guidelines, not a safety certification for any particular food or storage history.

Storage and checklists are browser-local. Clearing browser data or switching browsers/devices does not carry them over. JSON backup is an export for safekeeping; a restoration/import interface is not included in this release. Existing profile, recipe, nutrition, pantry, hydration and exercise tools are retained. This release adds no subscription, new account system, AI-service dependency, purchase, or credential requirement.

## Review and publication

The existing Vercel production URL is https://auto-meal-planner-pi.vercel.app/. Source changes are committed on the feature branch and delivered through a pull request. The separate temporary Sandbox review URL is only a preview, has its own origin-local browser storage, and is not the production site. Never describe a successful preview or build as a live update. After approval, merge the exact approved revision through the existing pipeline and verify the actual production domain.
