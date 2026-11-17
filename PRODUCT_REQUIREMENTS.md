# Initial development requirements

Target: small and medium-sized food manufacturers; first pilot OG TOFU in Latvia. Initial MVP deadline: **November 24, 2026**. The README remains the source for customer context, pilot values and long-term vision. Manufacturer and consumer research is ongoing; feature demand and business model are not yet validated.

## Core workflows in this foundation

1. Open the demo and inspect reported versus assumed inputs.
2. Edit company/product names, monthly production, packaging shares, material prices, labor method/rate and machine cycle/staffing inputs.
3. See immediately recalculated quantities, material/labor costs, cost/kg and estimated worker-hours.
4. Change a separate alternative scenario, compare with the current operation and copy current inputs when needed.
5. Refresh or return later to restore the profile and both scenarios in the same browser.
6. Visit an explicitly unfinished inventory page to understand the data still required.

## Functional requirements and acceptance

| Requirement                         | Acceptance criterion                                                                                              |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Modular React/TypeScript foundation | Vite, Tailwind, Router, Recharts and Vitest are installed; build and type checks pass                             |
| Source transparency                 | Original demo sources are visible; edits are labeled assumptions; missing numeric values stay null                |
| Deterministic calculations          | All reference outputs match the README; no AI-generated numbers                                                   |
| Input validation                    | Invalid values or mixes stop affected calculations with a visible error                                           |
| Labor separation                    | Only the chosen per-package or hourly method contributes cost                                                     |
| Rounding                            | Fractional package demands round up separately; capacity and planned kg are distinguished                         |
| Dashboard                           | Volume changes recalculate real engine results immediately, including zero/missing inputs                         |
| Scenario comparison                 | Baseline and alternative inputs persist independently; unequal volume comparisons are labeled                     |
| Local persistence                   | Versioned storage restores edited inputs; unreadable/blocked storage is reported                                  |
| Navigation                          | Dashboard, company profile, simulator and placeholder inventory pages work on desktop and narrow screens          |
| Multi-entity architecture           | Models and engine support multiple products, formats, materials, suppliers and machines without OG TOFU constants |
| Collaboration                       | Setup, formulas, agent guidance, feature-branch workflow and CI are documented                                    |

## Scope boundaries and limitations

The frontend described above is the initial foundation slice, not completion of every README MVP success criterion. Inventory forecasts, purchasing, machine capacity utilization, investment analysis, supplier onboarding and adding/removing catalog entities in the UI remain incomplete. Existing demo values are editable; additional entities can be represented through the shared model and are tested at engine level. Machine processing inputs are shared across both scenarios, so independent machine comparisons are not yet available.

The initial UI edits company name/country and product name. Catalog dimensions, shelf-life, storage/category, supplier and inventory records are modeled or displayed but have no comprehensive onboarding forms yet. They must not be inferred from missing data. There is one active company workspace and one editable alternative. No authentication, shared editing, storage migration from future schema versions, or audit history is implemented. Browser storage can be cleared by the browser and does not sync with GitHub or other teammates. A corrupt saved record is preserved until the next valid edit; invalid structural edits are visible in session but are not saved.

The demo mix is hypothetical, and some formats may not be commercially active. Material price is a midpoint assumption inclusive of labeling. One worker and continuous cycle occupancy are assumptions, not measured labor. All formulas, validation limits, rounding and exclusions are in CALCULATIONS.md. This version does not certify food-contact compliance, shelf life or machine compatibility.

## Later work, subject to research

Before the MVP demonstration, prioritize validating real mix/time/staffing inputs, completing stock and supplier input forms and deterministic inventory planning, and conducting pilot usability tests. Later candidates include machinery alternatives, investment payback, saved scenario collections, backend persistence and authenticated collaboration. AI chat, forecasting, supplier research, reporting and ERP integrations are hypotheses for later tasks. Never present mock AI answers or fabricated savings as product functionality.

## Phase 1 backend foundation

This phase adds an independent local-demo REST API without frontend integration. Target workflows are storing editable business records, calculating unsaved scenarios, persisting modeled scenarios, comparing investment alternatives and estimating stock requirements. The frontend inventory page remains a placeholder; the backend now calculates inventory plans.

Acceptance criteria:

- Fastify versioned JSON endpoints and Zod validation cover companies, products, suppliers, materials, formats, machines, inventory and scenarios. Responses/errors are consistent.
- Prisma SQLite migrations provide real foreign keys, company-scoped relationships and an exactly-one inventory-reference CHECK. The non-destructive seed is repeatable.
- Numeric inputs retain units, decimal-string precision, quality and missing status. No fabricated bag dimensions, price split, investment quotes or supplier information.
- Exact OG TOFU totals and unrounded cycle-derived machine time pass automated tests. Fractional quantities preserve mass where feasible and explicitly report residuals/deviations.
- Scenario comparison separates unit economics from spend. Savings require comparable demand/volume and known recurring costs; non-positive savings never produce positive payback.
- Inventory supports daily/weekly demand, coverage, reorder point/date, MOQ and explicit outstanding-order inputs. Calendar/working-day assumptions are documented.
- API integration tests run against a fresh migrated SQLite database, including cross-company relation rejection and local-demo restrictions. Type checks and production build pass.
- The compiled API runs locally without paid services, external APIs or cloud credentials.

Out of scope: new frontend work, public deployment, authentication, tenant authorization, PostgreSQL execution, real-time inventory, supplier discovery, machine learning and AI chat. Backend input snapshots do not synchronize automatically with catalog changes or browser profiles. The next integration task must reconcile rounding policies and establish authentication/ownership before public access. Full schema, formulas, computational limits and operating assumptions are in [backend/README.md](backend/README.md).
