# Verification record

Validated locally on November 17, 2026 with Node.js 24.22.1.

- Dependency installation completed; package-lock.json is included.
- `npm run typecheck`: passed.
- `npm test`: 44 tests passed across 3 files (34 engine/comparison, 5 storage, 5 application integration).
- `npm run build`: passed; Vite generated the production bundle with the chart loaded as a separate chunk.
- `git diff --check`: passed.
- Chromium browser smoke check on the Vite development server: reference dashboard, 2,000 kg recalculation, persistence after reload, separate simulator, hourly labor switching, company-name persistence and inventory navigation passed without page runtime errors.
- Desktop (1440 px) and mobile (390 px) screenshots inspected. Chart renders and mobile page has no horizontal document overflow.

The exact reference assertions are 800 / 300 / 200 packages, 1,300 total, €91 material, €195 labor, €286 operating cost and €0.286/kg. Additional tests cover zero/missing production, missing prices, invalid negative/non-finite inputs, fractional demands, hourly staffing, multi-product aggregation, decimal boundaries, unsafe counts, storage failures and restoration.

This is local verification, not a claim of deployed acceptance testing. Automated component tests mock chart geometry; the real chart was checked separately in Chromium. No cross-browser suite, pilot user acceptance, inventory algorithm, supplier verification or production deployment has been performed. GitHub Actions is configured to repeat the core checks on pushes and pull requests.
