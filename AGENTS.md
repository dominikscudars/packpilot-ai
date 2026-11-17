# Development instructions

Read the entire README.md and PRODUCT_REQUIREMENTS.md before changing product behavior. Customer research is ongoing; speculative roadmap items are not approved implementation scope.

## Organization and TypeScript

- UI belongs in `src/components` and `src/pages`; shared interfaces and runtime schemas in `src/models`.
- Keep deterministic pure functions in `src/calculations`, scenario comparisons in `src/optimization`, future stock logic in `src/inventory`, examples in `src/demo`, persistence in `src/storage`, and tests in `src/tests`.
- Use strict TypeScript; avoid `any`, unsafe casts and non-null assertions unless a preceding validation proves the invariant.
- Use unit-bearing property names: grams, kg, packages, seconds, worker-hours, euro/package, euro/kg. Do not mix machine-hours and worker-hours.
- Keep the engine independent of React, localStorage, company names and OG TOFU constants.

## Accuracy and validation

- Read CALCULATIONS.md. Keep formulas, UI wording and automated expectations consistent.
- Preserve input provenance. Distinguish reported estimates, assumptions and missing values (`null`). User edits are unverified assumptions unless a source is recorded.
- Reject negatives, non-finite values, invalid weights, invalid shares, duplicate identifiers and broken references. Preserve unknown financial outputs; never silently substitute zero.
- Labor pricing is a discriminated union. Never combine per-package costs with hourly costs for the same scenario.
- Do not fabricate supplier details, wages, financial savings, ROI, inventory, compliance claims, shelf life or machinery compatibility.
- Document rounding, exclusions, data sources and behavioral assumptions when introducing a formula. Do not silently alter reference inputs.

## Tests and collaboration

- Run `npm run typecheck`, `npm test`, and `npm run build` before reporting success. Add meaningful regression tests for changed calculations and persistence behavior.
- Retain exact OG TOFU reference assertions. Cover missing inputs, zero production, rounding, multiple formats/products and invalid values.
- Work on a descriptive feature branch; submit focused pull requests with behavior, assumptions and actual validation results. Do not merge or push directly to main without instruction.
- Coordinate changes to shared models through the PR. Include the lockfile when dependencies change.
- Do not commit secrets, customer data beyond the authorized demo, node_modules or generated builds. Browser storage is demo persistence, not multi-user infrastructure.
