# Meal planner audit and repair plan

## Required outcome
Audit and update the existing app at https://auto-meal-planner-pi.vercel.app/ so its existing functions work, including correcting mismatched or broken food-item images. Preserve the user's existing app, local meal/health data and GitHub/Vercel deployment; do not substitute a demonstration or redesign.

## Implementation approach
Use the verified source in `jarvisdasec-sys/auto-meal-planner`, baseline `024edd82401e30bf549c911daa135ba05d12c251`, on a repair branch. Independently audit the eight existing dashboard sections and the shared image pipeline, consolidate confirmed findings, then repair shared calculations/storage/image contracts before their dependent UI flows. Retain honest distinctions between estimated nutritional/price data and verified provider data; optional external services must have useful, accurate failure states rather than fabricated results.

Add repeatable pure-logic, store, component and API tests for confirmed defects. Keep reliable TypeScript and lint checks in the existing npm toolchain and verify a production build. Existing Next.js 14.2.5 has critical reported vulnerabilities and is outside current LTS; choose a supported, registry-available compatible release after checking official security guidance and peer requirements. Do not apply a blind forced dependency upgrade or change Vercel/account configuration.

For images, trace food identity and preparation through the renderer/resolver/cache/API chain. Reuse accurate existing assets where suitable, acquire verified food-specific assets where necessary, and use a clearly neutral labeled fallback when an exact product image is unavailable. Never replace one mismatch with an unrelated attractive stock photo. Verify response/load behavior and visual correspondence separately. Preserve aspect ratios and describe portion quantities in accessible HTML rather than inventing exact visual weights.

## Existing design
Reuse the existing rounded dark utility dashboard: slate surfaces, the actual `#7c5cff` purple accent, green/amber/red status colors, existing font hierarchy and responsive navigation. Preserve its card structure and wordmark. Favor readable status messages, explicit validation and accessible modal/tab behavior; keep animations minimal and respect reduced-motion preferences. No new hero, brand palette, marketing sections or decorative assets are required.

## Project structure
`app/` owns the single dashboard route, shared layout/styles and food-image API routes. `src/components/` owns each existing section and its coupled modals. `src/store/useMealPlannerStore.ts` is the persisted client-state boundary. `src/lib/` owns calculations, food/image resolution, provider adapters, pricing, storage and portion data. `src/data/` and `src/types/` define catalog/nutrition data and contracts. `public/images/` holds local image assets; `scripts/` holds repeatable asset utilities. Tests will live alongside modules or in a dedicated `tests/` folder according to fixture needs.

## Publication boundary
Save a tested pull request and review preview first. Present the exact completed repair scope for approval before merging production main. The earlier approval to publish BTB group workouts applies only to that earlier feature, not this meal planner. After approval, wait for the existing Vercel production deployment and verify this exact live URL before describing it as updated.
