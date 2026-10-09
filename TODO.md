# BTB premium meal-planner upgrade

- [x] **BTB identity and accessible theme:** replace Fitness & Meal Planner with BTB Meal Planner in the homepage, metadata and PWA; use reference neon green/black throughout, readable black text on neon actions, neutral charcoal surfaces, responsive navigation and reduced-motion/keyboard support. Preserve existing tools and image assets.
- [x] **Real Overview:** default to a useful dashboard with actual logged nutrition separate from planned nutrition, current calorie/macro targets, weekly coverage, hydration and working shortcuts. Empty states must lead to existing profile/plan/log tools.
- [x] **Seven-day board:** select a start date, generate a persisted plan, inspect all days, change servings, use guarded replacements, copy a day, export CSV and print the plan. Every downstream plan/prep/grocery view must use the same resolved persisted slots. Targets must not be represented as achieved when selections fall short.
- [x] **Meal Prep workspace:** create plan-specific batch lists using actual serving sums, household scaling, prep/cook estimates, dates, checklists, notes, storage guidance and printable prep sheets. Do not reuse completion states for unrelated plans; show accurate safe-storage guidance and sources.
- [x] **Professional shopping:** household-scaled requirements, pantry subtraction, budget comparison, durable purchased checkmarks, missing-price disclosure, aisle grouping, CSV and print work. Checked purchases do not automatically become pantry stock; expired recorded inventory is not counted as usable.
- [x] **Recipe builder:** create validated recipes with name, yield, per-serving calories/macros, ingredients, instructions, meal window and allergens; new recipes appear in existing Recipe Box and can use its existing logging/plan flows. Invalid values and exclusions have actionable states.
- [x] **Backup/export and preservation:** export browser-local planner and workspace data, export dated food history CSV, preserve the existing storage key and records with guarded hydration. Clearly state that no cloud account sync is provided.
- [x] **Complete verification:** run pure-logic, store and component regressions, TypeScript/lint/production checks, read-only integration review and focused usability verification; fix confirmed defects before review delivery.
- [x] **Review handoff:** save a tested GitHub PR and verify an accessible review preview. Present exact completed scope before production merge/publication and leave production unchanged pending approval.

Review PR: https://github.com/jarvisdasec-sys/auto-meal-planner/pull/2

Verified temporary preview: https://3000-iycaq5ixkg1d3h08nphk8-f94320cc.us1.manus.computer

Earlier premium release PR #2 was approved and published. New client-growth release below remains a review candidate.

# Complete-recipe review release

- [x] Quantified cookable recipe meals with instructions, ingredient-derived nutrition/cost reference estimates and seven-day generation; profile exclusions honored throughout generate/swap/load.
- [x] Working recipe day/date view, swaps/locks/regeneration, favorites/named save/load, household aggregate shopping and batch prep, print/download, explicit dated consumption logging only on user action.
- [x] Prior records and tools retained; separate validated recipe persistence and hydration; accurate storage failure/browser-local status; no fake accounts/paywall.
- [x] Client-friendly overview and query deep link, readable responsive black/neon interface; no invented intake/completion.
- [x] Full local regression/type/lint/build checks pass (108 tests), independent review findings corrected, desktop/mobile real-browser generation/lock/save/shopping/prep/logging/full-week print verified.
- [x] Review candidate saved to feat/btb-client-growth with linked working preview on port 3103; production remains unchanged pending owner approval.
