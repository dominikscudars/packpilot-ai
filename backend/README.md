# PackPilot AI backend foundation

An authenticated REST API for packaging business records, deterministic costs, scenario comparisons and stock planning. Node.js 24 LTS, strict TypeScript, Fastify, Zod, Prisma 6.19 and SQLite. Offline development and tests run without external services or credentials; deployed authentication uses Supabase Auth. The existing frontend remains a separate application using browser storage.

## Setup and execution

From the repository root:

```sh
cd backend
cp .env.example .env
npm ci
npm run db:generate
npm run db:migrate
npm run db:seed
npm run auth:setup
npm run members:bootstrap -- og-tofu 11111111-1111-4111-8111-111111111111
npm run dev
```

The server listens on **http://127.0.0.1:3001**. Check `curl http://127.0.0.1:3001/api/v1/health`.

For a compiled build:

```sh
npm run typecheck
npm test
npm run build
npm start
```

`npm start` serves `dist/src/server.js`; run from `backend/` so `.env` is found. `DATABASE_URL=file:./dev.db` resolves relative to `backend/prisma/schema.prisma`. The migration command creates a missing parent/file without truncating existing data, then runs Prisma migrate deploy. It never resets a database. The seed is transactional and idempotent: it only creates missing demo records, preserving previous edits.

Tests create a fresh temporary SQLite file, apply the checked-in migration, seed it and exercise the actual Fastify/Prisma integration. They do not use your development database. Run frontend checks separately from the repository root.

## Authentication and access

Read [AUTHENTICATION.md](AUTHENTICATION.md) for Supabase setup, offline signed-token development, initial ownership, role permissions, allowed frontend origins and deployment requirements. Company data and calculators now require a Bearer access token. Only health and CORS preflight are public. Members can work with their company's operational records; owners additionally manage company settings and memberships. All company lists are filtered by membership, and other-company requests return 404.

The `.env.example` explicitly enables loopback-only local authentication. Production must use Supabase mode and an asymmetric signing key; missing configuration fails closed. No privileged Supabase key belongs in frontend code. This phase does not deploy the API or connect the frontend.

Bodies remain limited to 128 KiB, collections to 100 records per page, and calculations to their documented computational bounds. Authenticated production deployment still needs persistent storage, HTTPS, provider configuration and operational rate limits/monitoring.

## Structure

```text
backend/
  src/
    app.ts                    Injectable Fastify app; no listening side effects
    server.ts                 Configuration, startup and shutdown
    config/                   Environment validation
    auth/                     JWT verification, membership guards and ownership bootstrap
    domain/                   Zod contracts, inferred TypeScript types, demo inputs
    calculation-engine/       Pure allocation, cost, comparison and inventory logic
    modules/
      companies/ products/ packaging/ machines/ costs/ scenarios/ inventory/
    shared/                   CRUD transport helpers and transactional demo seeding
  prisma/
    schema.prisma             Relational model
    migrations/               Reproducible initial migration and constraints
    seed.ts                   Seed entry point
  scripts/migrate.ts          Safe local file preparation + Prisma migrate deploy
  examples/                   Executable JSON request examples
  tests/                      Pure-engine and real database/API tests
```

## Numerical contract and data quality

Important numeric values use a quantity object. Values are **decimal strings**, not JSON numbers:

```json
{
  "value": "0.07",
  "quality": "assumption",
  "sourceNote": "Illustrative combined bag and label estimate"
}
```

A missing value is `{"value":null,"quality":"missing"}`. Other quality statuses are `reported`, `verified`, and `assumption`. Null and `missing` must agree. A status records the caller's evidence claim; the software does not certify it. Values must be non-negative plain decimals, at most 12 decimal places and at most 1 billion. Counts and staffing require integers where applicable. Units are in field names. Currency is EUR.

Decimal.js uses 40-digit working precision; financial, mass, time and percentage outputs are decimal strings with up to 28 significant digits. Whole package counts are safe JSON integers. No cent rounding occurs in the engine. Clients should format displayed euro amounts separately.

Numerical database fields are JSON quantity objects containing decimal strings. This prevents SQLite numeric affinity from converting monetary values to floating point, and preserves provenance beside the value. Do not bypass Zod when writing records. IDs, ownership and relationships are relational foreign keys. Composite foreign keys enforce that linked products, formats, materials, suppliers, machines and scenarios belong to the same company. Inventory has an additional SQL CHECK requiring exactly one format or material reference. These data-integrity checks do **not** replace user authorization.

`src/domain/entities.ts`, `scenario.ts`, `inventory.ts` and `inputs.ts` are the authoritative request schemas. Unknown properties are rejected. PATCH accepts supplied top-level fields only; omitted fields remain unchanged. Nested objects/arrays are replaced as whole values, not deeply merged. A null quantity still needs its quality object. ID, company ownership and timestamps cannot be changed through payloads.

### Entity fields

All persisted entities have generated IDs and created/updated timestamps, except relational join records. Collection children inherit `companyId` from the URL.

| Entity    | Required creation fields                                        | Other supported fields                                                                                                               |
| --------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Company   | `name`                                                          | `industryCategory`, `country`                                                                                                        |
| Product   | `name`                                                          | `category`, `storageRequirements`, `shelfLifeDays`, `shelfLifeNote`, `lengthMm`, `widthMm`, `heightMm`                               |
| Supplier  | `name`                                                          | `contactInformation`, `leadTimeCalendarDays`, `minimumOrderPackages`, `quotations` (provided text only)                              |
| Material  | `name`                                                          | `structure`, `supplierId`, `unitCostEuroPerPackage`, `technicalSpecifications`, `foodContactDocumentationStatus`, `validationStatus` |
| Format    | `productId`, `materialId`, `portionWeightGrams`, `materialCost` | `lengthMm`, `widthMm`, `heightMm`, `commercialStatus`, `dataQualityStatus`                                                           |
| Machine   | `model`, `throughput`, `operators`                              | `investmentEuro`, `maintenanceEuroPerMonth`, `availableHoursPerMonth`, `dataQualityStatus`                                           |
| Inventory | Exactly one of `formatId` / `materialId`                        | `currentStockPackages`, `packagesPerProductionKg`, `supplierLeadTimeCalendarDays`, `minimumOrderPackages`, `safetyStockPackages`     |
| Scenario  | `name`, `kind`, `input`                                         | `kind` is `reportedBaseline` or `modeled`; snapshot schema version is maintained by the server                                       |

Unknown optional numeric values default to the explicit missing quantity, not zero. Unknown text/reference values default to null. Material documentation status is `unknown`, `provided` or `reviewed`; validation is `unvalidated`, `reported` or `verified`. Neither certifies food-contact compliance. Format commercial status is `unknown`, `illustrative` or `active`.

Saved scenarios retain versioned input snapshots and relational format/machine links. Later catalog edits do not retroactively change a scenario. To simulate a catalog update, explicitly update the scenario's snapshot. Scenario creation/update verifies its complete calculation model and all company-scoped references; incomplete draft scenarios with missing production/mix are not yet supported. Other business records can retain missing quantities.

## REST endpoints

Successful responses use `{ "data": ... }`. Lists also return `{ "pagination": { "limit": 50, "offset": 0 } }`. POST creates return 201; DELETE returns 204. Other success responses return 200.

| Method             | Path                                           | Body / behavior                                   |
| ------------------ | ---------------------------------------------- | ------------------------------------------------- |
| GET                | `/api/v1/health`                               | Database connectivity and authentication mode     |
| GET, POST          | `/api/v1/companies`                            | List / create company                             |
| GET, PATCH, DELETE | `/api/v1/companies/:id`                        | Read / edit / delete unreferenced company         |
| GET, POST          | `/api/v1/companies/:companyId/:collection`     | List / create company-owned records               |
| GET, PATCH, DELETE | `/api/v1/companies/:companyId/:collection/:id` | Read / edit / delete a record                     |
| POST               | `/api/v1/calculations/packaging-costs`         | Independent `ScenarioInput`; no persistence       |
| POST               | `/api/v1/calculations/compare-scenarios`       | `{ baseline, alternative, sameProductAndDemand }` |
| POST               | `/api/v1/calculations/inventory-plan`          | Independent inventory planning input              |

Collections: **products, suppliers, materials, formats, machines, inventory, scenarios**. Owner-only membership endpoints are documented in [AUTHENTICATION.md](AUTHENTICATION.md). List query parameters are `limit` and `offset`. References restrict deletion; deleting a scenario removes its join records but leaves the catalog intact. Referential conflicts return 409.

Errors use `{ "error": { "code", "message", "requestId", "details"? } }`. Statuses: 400 malformed/schema-invalid request; 401 invalid/missing authentication; 403 role/origin/host restriction; 404 missing record/endpoint; 409 relation/uniqueness conflict; 413 oversized body; 422 invalid calculation/domain model; 500 generic internal failure. Schema details contain paths and messages, never submitted values or SQL.

### Executable examples

From `backend/`, with the API running and `PACKPILOT_TOKEN` set using the local token command or a Supabase access token:

```sh
curl http://127.0.0.1:3001/api/v1/companies/og-tofu/scenarios -H "Authorization: Bearer $PACKPILOT_TOKEN"

curl -X POST http://127.0.0.1:3001/api/v1/companies   -H "Authorization: Bearer $PACKPILOT_TOKEN" -H 'Content-Type: application/json'   -d '{"name":"Example manufacturer","country":"Latvia"}'

curl -X POST http://127.0.0.1:3001/api/v1/calculations/packaging-costs   -H "Authorization: Bearer $PACKPILOT_TOKEN" -H 'Content-Type: application/json' --data-binary @examples/packaging-costs.json

curl -X POST http://127.0.0.1:3001/api/v1/calculations/compare-scenarios   -H "Authorization: Bearer $PACKPILOT_TOKEN" -H 'Content-Type: application/json' --data-binary @examples/compare-scenarios.json

curl -X POST http://127.0.0.1:3001/api/v1/calculations/inventory-plan   -H "Authorization: Bearer $PACKPILOT_TOKEN" -H 'Content-Type: application/json' --data-binary @examples/inventory-plan.json
```

The cost example returns 800 / 300 / 200 packages, 1,300 total, €91 materials, €195 labor, €286 operating cost and €0.286/kg. Machine-hours are approximately 12.6388888889. The comparison and inventory examples contain clearly labeled **synthetic assumptions**, not pilot investment quotes or stock data.

### Cost input schema

`monthlyProductionKg` is a quantity. `formats` is an array of 1–20 objects containing `id`, `portionWeightGrams`, `allocationPercent`, `materialCost` and nullable `machineId`. `machines` is an array of up to 20 objects containing `id`, `throughput`, `operators`, and optional investment, maintenance and availability quantities. Duplicate IDs are invalid; assigned machine IDs must be present.

`materialCost` is exactly one of:

- `{method: "combined", combinedEuroPerPackage: quantity}` — preserves a reported combined price when its split is unknown.
- `{method: "itemized", bagEuroPerPackage: quantity, labelEuroPerPackage: quantity}` — both prices are needed for positive quantities.

`throughput` is exactly one of:

- `{method: "cycle", packagesPerCycle: quantity, cycleSeconds: quantity}`.
- `{method: "rate", packagesPerHour: quantity}`.

`labor` is exactly one of `{method: "perPackage", euroPerPackage: quantity}` or `{method: "hourly", euroPerPersonHour: quantity}`. `additionalOperatingEuroPerMonth` is optional and defaults to missing. Known zero costs must be entered explicitly with a source/assumption status.

### Inventory input schema

Required quantity fields: `currentStockPackages`, `expectedMonthlyConsumptionPackages`, `calendarDaysInPlanningMonth`, `workingDaysInPlanningMonth`, `leadTimeCalendarDays`, `minimumOrderPackages`, `safetyStockPackages`. `reviewPeriodCalendarDays` defaults to missing. `asOfDate` is an optional valid `YYYY-MM-DD` UTC date. `outstandingPurchaseOrders` is null (unknown) or an array of `{ quantityPackages, dueDate }`; an empty array explicitly means none outstanding. The planner accepts up to 100 orders. Lead/review periods are limited to 3,660 days.

## Formulas and rounding

### Production allocation

Requested format kg = production kg × allocation percent / 100. The percentages must total exactly 100. Portion weights support three decimal places in grams, and production supports six decimal places in kg; internally allocation uses exact integer milligrams.

1. Start with floor(requested format grams / portion grams) for each positive-share format.
2. Allocate remaining mass with a deterministic integer dynamic program. Prefer formats by fractional package remainder, with input order resolving ties. No zero-share format receives packages.
3. If keeping those floor counts blocks an exact total but the total is divisible by the weights' GCD, try a full-mass feasibility search. This can significantly change the requested mix; the response warns and reports every format deviation. This is a mass-feasibility policy, **not** an optimal commercial mix recommendation.
4. If exact fulfillment is mathematically impossible within the configured portions, leave the residual unpackaged. Return requested mass, packed mass, unpackaged mass and signed deviations. Never silently manufacture extra product. Search is bounded to 200,000 GCD-normalized states; requests requiring more are rejected with 422 rather than silently approximated.

Package costs are charged only on the resulting whole packages. The response includes cost per **planned** kg and per **packed** kg. Unfilled scenarios are excluded from investment-savings comparisons.

This deliberately differs from the earlier frontend's independent round-up policy. The frontend is unchanged and is not connected to this API. Both produce the identical exact OG TOFU reference; fractional-volume behavior must be reconciled during a later frontend integration task.

### Costs and efficiency

- Material cost = packages × (bag + label cost), or packages × an explicitly combined cost.
- Effective cycle throughput = packages per cycle × 3,600 / cycle seconds. Compute hours as packages × cycle seconds / packages per cycle / 3,600 to avoid truncating 102.857142… packages/hour.
- Rate-based machine-hours = packages / packages per hour.
- Person-hours = machine-hours × operator count.
- Per-package labor cost = packages × euro/package; hourly labor cost = person-hours × euro/person-hour. Never both.
- Packaging operating cost = material + labor.
- Unit cost = packaging operating cost / planned or packed kg, as labeled. At zero production, packaging quantities/costs/hours are zero and unit costs are null.
- Utilization percent = machine-hours / declared available machine-hours × 100. Missing availability gives null.

Throughput is an average continuous production rate; the backend does not round to full machine cycles or add setup/downtime. Active machine maintenance is charged once per month, including at zero production if assigned to a positive-share format. Additional monthly operating costs are separate. Missing timing/staffing preserves unknown hours; per-package labor remains calculable. Any missing required material or labor input makes that category and aggregate unknown; unaffected categories remain available.

### Scenario comparison

Absolute change = alternative − baseline. Percentage change = absolute / baseline × 100, or null if baseline is zero/unknown. Compare unit costs separately from expenditure. Savings require equal, positive, fully packed production, explicit `sameProductAndDemand: true`, and known recurring costs in both scenarios.

Net monthly savings = baseline(material + labor + maintenance + other recurring costs) − alternative(same). Potential positive savings = max(net savings, 0); annual potential = monthly potential × 12. Simple payback months = alternative upfront investment / **positive** net monthly savings. Alternative investment values represent new cash outlay; baseline investments are sunk costs. Unknown investments or non-positive savings yield null payback. Financing, taxes, discounting, resale and changing monthly demand are excluded. These are modeled results, not verified savings.

### Inventory planning

Calendar daily consumption = expected monthly consumption / stated calendar days (28–31). Working-day consumption = monthly consumption / stated working days (1 through calendar days). Weekly consumption = calendar daily × 7. Calendar rates govern all forecasts; working-day rates are descriptive. Uniform consumption is a deliberate simplification.

Coverage days = stock / calendar daily consumption. Zero demand is unbounded coverage (null value with `coverageStatus: "unbounded"`), not an infinity serialized as a number. Missing demand is unknown.

Reorder point = ceil(calendar daily × lead-time days + safety stock). Order-up-to target = calendar daily × (lead + review days) + safety stock. Suggested order = max(ceil(target − current stock − eligible incoming orders), 0), raised to MOQ only if positive. MOQ is a minimum order size, not an order multiple. Zero demand can still require safety-stock replenishment.

Receipts are credited only if known, not overdue, and due by the lead-time arrival date. Later receipts are excluded with a warning. Unknown receipt quantities or overdue orders block a definitive order suggestion. Unknown outstanding orders are not assumed to be an empty list. Dates require an explicit as-of date. The conservative reorder date is as-of + floor(max((stock − reorder point)/daily consumption, 0)); eligible receipts arriving on/before that trigger extend it. Dates beyond 10 years are omitted. Actual schedules, supplier reliability and stock movements are not integrated.

## Seed assumptions and limits

The seed uses the supplied pilot data, including reported refrigeration at approximately +2°C to +6°C and about 10 days of shelf life. The 80/15/5 weight mix is hypothetical. All three formats are marked illustrative; 250 g is not asserted to be actively sold. €0.07 is a combined material+label estimate with no invented split. One operator is assumed. Bag dimensions, supplier quotes, current inventory, investment, maintenance, capacity and additional overhead are missing. Material names do not imply suitability, food-contact compliance or shelf-life validation.

There is no frontend integration or migration of existing browser data, machine batch scheduling, multi-currency support, real-time stock integration or AI service. Inventory consumption is provided by the caller; the API does not silently turn a packaging scenario into a stock plan. Quotation/contact/specification fields store supplied text and do not retrieve external data. Packaging quantity is expressed as packages, not meters of film or roll counts.

## Extending and migrating to PostgreSQL

Keep domain/calculation modules free of Fastify and Prisma. Validate at request boundaries and public engine entry points. Record changes to formulas, input quality and rounding in this document with regression tests. Foreign-key and CHECK protections must remain covered by real-database tests.

Prisma 6 is deliberately pinned by the lockfile for its straightforward SQLite runtime. To move to PostgreSQL, change the datasource provider, configure its URL, generate a **new PostgreSQL migration history**, copy validated data and regenerate the client. Do not replay SQLite SQL on PostgreSQL. IDs/relationships and JSON decimal-string quantities can remain unchanged (PostgreSQL JSONB supports them). If indexed financial aggregates are needed, migrate selected decimal strings to explicit NUMERIC columns with matching provenance fields. Preserve the inventory CHECK and composite company-scoped constraints. Test the target database before deployment; this phase only executes SQLite.
