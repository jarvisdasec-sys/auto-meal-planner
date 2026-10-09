# BTB Meal Planner

The existing Next.js meal-planner dashboard, hosted at https://auto-meal-planner-pi.vercel.app/. This repository remains the site's actual GitHub/Vercel source; it has not been replaced with a separate prototype.

## Development and verification

Use Node 22.13 or later supported by npm 11 and the pinned toolchain. The package manager is recorded in `package.json`; dependency versions and compatible overrides are locked.

```sh
npx --yes npm@11.21.0 ci
npm run check
npm run lint
npm test
npm run build
npm run start -- --hostname 0.0.0.0 --port 3000
```

`npm run dev` starts the usual Next development server. The app has one page (`/`) and two existing image API endpoints. `public/manus-routes.json` declares the page route; it is not an API manifest.

## Application structure

`src/components` contains the BTB navigation shell, new Overview, seven-day planner, Meal Prep, household Shopping List, Recipe Builder and Backup/Settings, plus all retained dashboard tools and forms/modals. `src/store/useMealPlannerStore.ts` retains browser-local profile, plan, pantry, intake, exercise, hydration and recipe state; `useWorkspaceStore.ts` separately persists household/budget preferences and plan-scoped checklists. Both use guarded client hydration. `src/lib` contains shared local-date, nutrition-snapshot, validation, dietary evaluation, weekly-plan, prep, export and grocery helpers. `src/data/nutritionDatabase.ts` and `src/lib/foodCatalog.ts` are the stable seed sources. `app/api` provides bounded image-enrichment endpoints.

Forty committed local food assets cover all 41 seed records, with broccoli shared. `src/lib/foodPhotos.ts` maps reserved seed IDs and approved generic aliases; unrelated products cannot inherit a branded package through a generic name. `public/images/foods/*-sources.json` records provenance; five portion-guide PNGs are separate approximate hand illustrations. `npm run generate:portion-guides` verifies these illustrations and does not recreate the previous geometric placeholders.

Source records document the image library’s provenance. Acquisition utilities are not part of the production app. The application does not need external review records, Python, generation tools or a paid image provider to display its committed food library.

## Data and provider limitations

Nutrition, cooking/hand portions and grocery prices are estimates. Current labels must be checked for serving sizes, allergens and cross-contact; generic images are illustrative, and product variants/package sizes can differ. Camera scanning requires browser support/permission and HTTPS; manual barcode entry remains available. Open Food Facts is an external source with variable availability/coverage. Optional Kroger enrichment uses the existing owner environment credentials; missing provider access does not prevent built-in food images from working.

Personal data remains local to the user's browser when storage is available; no account/cloud-sync service was added. Test fixtures are fabricated and do not mutate actual user health records.

## Audit and deployment

See [the audit and repair summary](docs/audit-report.md) for confirmed defects, repairs, test evidence, image ambiguities and remaining development-only dependency advisories. Production dependencies report zero advisories at the reviewed revision; this does not mean all development tools are vulnerability-free.

See [the premium upgrade summary](docs/premium-upgrade.md) for the BTB identity, weekly/prep/shopping/recipe/backup features and limitations. The upgraded release has 95 passing tests, clean TypeScript/lint and a successful production build.

Changes are reviewed on a feature branch and published through the existing GitHub/Vercel production pipeline only after the owner's approval. A passing local build or PR preview is not a live publication. Keep any production merge tied to the approved PR head and verify the actual live domain afterward.
