# Meal Planner — Functional Audit and Repair Summary

**Site:** https://auto-meal-planner-pi.vercel.app/  
**Actual source:** `jarvisdasec-sys/auto-meal-planner`  
**Review date:** October 8, 2026  
**Status:** Repairs implemented in the actual source; production publication awaits owner approval.

## What changed

The app was audited across its eight existing sections and its shared image pipeline. The existing dark dashboard and navigation were retained. Confirmed defects were repaired rather than replacing the app with an unrelated prototype. All mutation tests use fabricated local fixtures, not the owner's real health records.

| Area | Confirmed issues repaired |
| --- | --- |
| Profile Setup | Draft fields no longer mutate the saved profile before Save. Validated metric/imperial conversion, numeric limits, preference/exclusion persistence, real save feedback and late-hydration protection. |
| Daily Meal Plan | Generate/regenerate and substitutions now use one persisted seven-day plan. Cards, batch preparation and pantry views share its actual slots. Selected raw/cooked basis, serving multipliers and explicit oil are calculated consistently. Planned intake is logged to the selected plan date. |
| Calorie, exercise and hydration trackers | Totals, macros and lists use the same local calendar date and stored nutrition snapshots. Added validated editing/removal. Restaurant adjustments apply only to their dated schedule, not indefinitely. Manual serving/source details are retained. |
| Grocery Estimator | Quantities and totals derive from the active plan and actual pantry portions. Recorded stock is subtracted, store selection updates estimates, and modal/print contents agree. Missing prices show unavailable/partial totals rather than misleading free items. |
| Portion guide | Recommended foods respect the profile/active plan; historical cards use recorded intake rather than recomputed current defaults. Five recognizable hand illustrations replace geometric placeholders. Hand measures are explicitly approximate. |
| History | Local-date filtering replaces UTC-prefix grouping. Calories and macros reflect saved intake, including manual foods. Selected-date food, exercise and hydration entries have edit/remove controls. |
| Recipe Box | Logging is labeled truthfully and scales nutrition once. Search/filter/details retain recipe metadata. Adding to a selected plan day/window changes that slot without resetting the week; known exclusions are blocked. Legacy recipes remain supported. |
| Food Logger, custom foods and barcode flow | Validated manual/custom inputs, zero-calorie support, positive servings, metadata persistence, recipe yields and ingredients, safe custom images and storage error handling. Barcode scan/manual entry have found/not-found/error states, timeouts, cleanup and a basis-correct Open Food Facts adapter. |
| Image pipeline | Placeholders no longer suppress lookup. Exact product/UPC matches outrank generic-name fallback. Reserved seed identities refresh old incorrect image snapshots. Stale responses are ignored, hosts/inputs are validated, fallbacks are bounded and accessible, and full photos/package notices are preserved rather than cropped. |

## Corrected food images and source facts

**Forty local food assets cover all 41 seeded food/supplement records**; broccoli is shared. The library consists of 25 unbranded illustrative food images, nine genuine brand/product-family images and six exact ingredient artworks. Matching foods and product families were visually checked. Built-in foods no longer carry fabricated UPCs. Images are illustrative—not claims of an exact serving, cooking-weight basis or nutrition measurement.

Branded variants can differ by region, flavor and package size. The initially selected Australian MuscleTech 3 g pack was replaced with a verified current US 5 g image matching the seed; its package count can still differ (80 pictured vs approximately 90 on the page). C4/XTEND/Optimum Nutrition original seed variants were not fully specified. Their photos are not evidence that every original supplement nutrient/serving value matches a current label. These ambiguities are retained in the source records rather than filled with invented facts. Product artwork/notices remain intact.

Supported official facts corrected include Horizon whole milk calories/carbohydrates, Quest chocolate-chip cookie dough bar calories/fat and allergens, and McDonald's USA medium fries protein/allergens. The US fries are no longer falsely tagged vegan. Plain rice-and-salt cakes no longer carry the contradictory wheat/gluten tag that prevented the advertised alternative. Generic estimated nutrition is still not a laboratory-verified database.

Ingredient artwork attribution: [TheMealDB API guide](https://www.themealdb.com/docs_api_guide.php), [terms](https://www.themealdb.com/terms_of_use.php). Per-image source metadata is committed alongside assets. Exact branded source pages and qualified public-label facts are recorded in `verified-product-sources.json`.

## Validation evidence

The automatic suite currently has **75 passing tests in 22 files**, covering calculations, validation, persistence/legacy behavior, local dates, plan substitutions, pantry/grocery totals, profile saving, tracker editing, history, recipe replay, manual/custom foods, barcode lifecycle/provider states, every seeded asset and image fallback/identity behavior. Type checking and the production build passed. The final compatible dependency/lint pass and production-preview photo checks are recorded below when complete.

A separate read-only integration review identified the selected-plan-date/serving-metadata defects, contradictory rice-cake data and image type error; those confirmed issues were corrected and covered. There is no claim that automated tests prove every browser/camera or external provider condition.

## Limits that remain explicit

Nutrition, hand portions, calorie targets, cooking estimates and grocery prices are estimates, not personalized medical advice or verified live prices. Generated plan choices are constrained by the available catalog and do not guarantee an exact macro optimization. Current package/restaurant labels must be checked for serving sizes, allergens and cross-contact. Missing/unknown dietary facts are not an allergy-safety guarantee.

Barcode camera use requires a supported browser, HTTPS and permission. Physical camera hardware was not available for a real-device test; manual entry and denied/unavailable camera states are implemented and regression tested. Open Food Facts availability and product coverage remain external dependencies. Optional Kroger enrichment requires working owner credentials; built-in images do not depend on that integration.

Personal profiles/plans/logs remain browser-local when storage is permitted; there is no new account/cloud-sync service. Blocked storage leaves an in-memory session and actionable saving feedback where relevant. Existing valid history and custom data are retained; no broad clear or migration that rewrites historical calories was performed.

## Publication boundary

Changes will be saved in a source pull request and a tested review preview. Merging the approved exact version into the actual repository's production branch is the intended GitHub/Vercel publication path. **A successful preview or PR build is not a successful live update.** The production domain is not changed until the owner approves publication, and the final live version must then be independently verified.

### Dependency security result

The app's framework moved from the unsupported original Next 14 line to compatible **Next 15.5.27**, retaining React 18 and the existing Tailwind 3 design. Compatible PostCSS, source-map, test-runner and development-tool patches were applied using the pinned npm 11 toolchain. The reviewed native lint resolver's installation permission is recorded.

The production-only dependency audit reports **0 vulnerabilities**. The full development-tool audit still reports **9 advisories (7 high, 2 moderate; 0 critical)** in the Tailwind 3/lint glob-selector dependency chain. Some suggested automatic fixes require a Tailwind 4 migration or an ESLint-config major/downgrade; these were not forced into a functional-repair release. Remaining development-only advisories are explicit technical debt, not a claim of a completely vulnerability-free dependency tree.

### Final application checks

The final compatible patch set passed `npm run check`, lint with **no warnings or errors**, **75 tests in 22 files**, and the Next production build. The actual production-build review server returned HTTP 200 locally and publicly for `/` and its exact route manifest. All forty committed food-image requests returned valid WebP content. The actual image API returned the expected local chicken image for the seed ID and HTTP 400 for malformed input.

The Food Logger tab was checked in the actual rendered preview: its 21 food images were present; visible steak, chicken thigh, tuna, shrimp, milk and cheddar images loaded, carried descriptive illustrative labels, and preserved full content with `object-fit: contain`. No horizontal overflow was observed at the tested desktop viewport. The five focused unbranded corrections were visually verified; no additional cosmetic variation cycle was performed.

**Review preview:** https://3002-iianv6i1f3a4rq5n39n4k-bcf86da2.us1.manus.computer/ (temporary, not the live Vercel domain). Production publication is still pending explicit approval.
