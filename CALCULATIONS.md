# Packaging calculation contract

## Current application policy

The authenticated UI displays API results; the explicit local demo uses the same pure engines in `backend/src/calculation-engine`. The backend policy in [backend/README.md](backend/README.md#formulas-and-rounding) is authoritative. Whole packages preserve available production mass, report any unfilled kg and mix deviations, and use continuous throughput rather than rounded whole machine cycles. Exact shares total 100%; decimal-string inputs preserve provenance. Recurring operating costs and investment are separate and remain unknown unless supplied. The original OG TOFU reference below is unchanged. At 1.125 kg in that mix, 1 kg is packed and 0.125 kg remains unpackaged.

The following documents the **historical Phase 1 engine**, retained with its original tests for compatibility. It is not used by the current UI. Legacy browser profiles are not automatically migrated or uploaded because their rounding semantics differ. See [FRONTEND_INTEGRATION.md](FRONTEND_INTEGRATION.md).

### Phase 4 missing-equipment correction

A positive-share format with no assigned equipment makes total recurring equipment costs and investment unknown. It must not silently add zero or sum only the assigned subset when deciding savings/payback. Known material and per-package labor costs remain calculable; zero-share unassigned formats do not invalidate equipment totals. This changes neither allocation/rounding nor the exact OG TOFU reference.

## Historical engine

The engine is `src/calculations/packaging.ts`. All outputs are monthly estimates, not financial quotations. Values are finite JS numbers at API boundaries; decimal.js (40-digit precision) performs decimal arithmetic. Euro amounts retain fractional cents in the engine; the UI formats totals to two decimals and euro/kg to three. No intermediate per-package price rounding takes place.

## Production and package requirements

For each product and format:

- Target kg = production kg × share by weight.
- Required packages = ceil(target kg × 1,000 / package net weight in grams).
- Rounded package capacity kg = required packages × package weight grams / 1,000.
- Total packages = sum across product/format rows.

Shares must be present, between 0 and 1, and sum to 1 within 1e-9. An accepted tiny floating-point deviation is normalized to 1 before allocation. Shares are weights, not percentages of package counts. Packages are rounded up separately for each row, so capacity may exceed planned production. The final package can be partially filled; extra product is not assumed. Cost/kg uses planned production, not rounded capacity.

## Materials and labor

- Material euro = required packages × material-and-label euro/package.
- Machine cycles = ceil(required packages / packages per cycle).
- Machine-hours = cycles × cycle seconds / 3,600.
- Worker-hours = machine-hours × workers.
- Per-package labor euro = required packages × labor euro/package.
- Hourly labor euro = worker-hours × euro/worker-hour.
- Operating euro = material euro + labor euro.
- Packaging euro/kg = operating euro / planned production kg.

Exactly one labor method applies. Per-package labor never adds hourly costs. Processing inputs are still used to estimate hours. Each product/format uses separate whole cycles: no mixed-format batching. Staffing is a positive whole number. Cycle time may be fractional and must be positive. The initial one-worker assumption is unverified; equipment cycle time alone does not establish actual hands-on labor time. Setup, downtime, cleaning, break time and handling outside the reported cycle are excluded.

Unknown processing data produces unknown hours; per-package costs remain calculable. Hourly costs require valid timing, staffing and an explicit wage. A missing price for a positive-quantity row makes that cost category and the total unknown. Known categories remain visible. At zero production all quantities, hours and costs are zero, and cost/kg is not applicable (`null`). Missing production or mix prevents calculation instead of becoming zero. An unused zero-share row incurs zero cost even if its rate is missing.

## Reference fixture

Source: the full project README. OG TOFU reports approximately 1,000 kg/month, 2 packages/70 seconds, €0.06–0.08 bag-and-label cost/package and €0.15 labor/package. The 80% 1 kg / 15% 500 g / 5% 250 g mix and €0.07 material midpoint are assumptions. This yields 800 / 300 / 200 packages, 1,300 total, €91 material, €195 labor, €286 total and €0.286/kg. With one assumed continuously occupied worker, labor time is approximately 12.6389 hours.

## Supplier quote comparison

`src/calculations/supplierQuotes.ts` compares 2–3 bag-and-label quotes with the saved material cost. It uses the engine's monthly package count unchanged; one quoted price per pack applies to every pack size. Labour, machine and other costs are identical across quotes and excluded.

- Quote material per month = price per pack × total packages, rounded to €0.01.
- Material per kg = quote material per month ÷ monthly production kg, to €0.0001; Unknown at zero production.
- Saving (−) or increase (+) = quote material per month − current total material cost; Unknown when any pack size lacks a material cost (never €0).
- Minimum order covers = minimum order packs ÷ total packages months (one decimal); first-order cash = minimum order × price + optional setup fee.
- Setup fee recovered in = setup fee ÷ monthly saving, only when the fee is above 0 and the quote saves money.

Quotes are user-entered and unverified; VAT, delivery, storage and specification or food-contact differences are excluded. The "Load example supplier quotes" values (`src/demo/supplierQuotes.ts`) are invented for the demo, sized for about 1,300 packs a month.

## Validation and limits

Numeric inputs are finite, non-negative and at most 1e12. Weights are strictly positive. Counts of packages per cycle and workers must be positive integers. Each catalog's IDs, product plans and per-product format allocations must be unique. Active references must resolve. Package counts and their aggregate must be safe integers. Extremely small weights that overflow the count are rejected.

Outputs exclude equipment investment/depreciation, energy, maintenance, taxes, freight, waste and overhead. The comparison is alternative monthly cost minus current monthly cost; differing volumes are labeled as incomparable savings. It is not an optimizer or investment recommendation. Capacity utilization and financial returns are not implemented. Suppliers, formats and machines are data-driven; no company-specific constants belong in calculation functions.
