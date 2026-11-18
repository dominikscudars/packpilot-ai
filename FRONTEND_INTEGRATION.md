# Frontend integration and authentication

The React application now has two explicit workspaces. **Sign in** opens authenticated company data from the API. **Open local demo** opens a browser-only OG TOFU example. Authentication failures never fall back to demo data.

## Run locally without cloud credentials

Use Node 24, `npm ci`, and `npm run dev` at the repository root. Open the printed URL and choose **Open local demo**. No API, keys or cloud account are needed for the demo. It uses the backend's browser-safe pure calculation engines, so rounding matches the authenticated application. No server, Prisma, signing-key or environment modules are imported into the browser.

Demo changes are saved only by explicit save actions under `packpilot.demo.v2`. The old `packpilot.workspace.v1` record is left untouched and never read, migrated or uploaded by the integrated application. To deliberately reset the new demo, delete only `packpilot.demo.v2` in browser developer tools. Blocked/corrupt storage is reported; a fresh demo can still run in memory. The old engine and storage modules remain as historical compatibility code with their original regression tests; the current application does not use them.

For real local API integration without Supabase, follow [backend/AUTHENTICATION.md](backend/AUTHENTICATION.md) to generate local signed tokens and use the API CLI. Run the automated HTTP integration suite described below to exercise the frontend client against that same verification path. The production frontend has no pasted-token login, auth bypass, bundled development JWT or test-user configuration.

## Frontend environment variables

Copy `.env.example` to `.env.local` for local authenticated development. Vite reads these values at **build time**. A changed value requires restarting Vite or rebuilding the frontend.

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | API origin without a trailing slash, path, query or credentials. Example: `http://localhost:3001` in development; `https://api.example.com` in production. Client paths add `/api/v1`. |
| `VITE_SUPABASE_URL` | Supabase project origin, e.g. `https://your-project-ref.supabase.co`. Must match backend `SUPABASE_URL`. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Public browser client key beginning `sb_publishable_`. Find it under the Supabase project's API keys. Legacy anon JWT keys are deliberately not accepted; use the current publishable key. |

Supabase variables must be supplied together. Production authenticated URLs require HTTPS; development HTTP is allowed only on loopback. `VITE_*` values are public and are embedded in the browser bundle. **Never supply a service-role key, `sb_secret_` key, JWT signing secret, private key, database password or admin credential.** The client rejects non-publishable key formats. Neither frontend nor backend needs a privileged Supabase key for this workflow.

## Supabase and API setup

1. Create/select the project and enable email/password sign-in. Create the intended user accounts using Supabase's supported dashboard/admin workflow; confirm emails as required. This phase adds sign-in/sign-out, not self-service signup, password reset or email invitations.
2. Use asymmetric **ES256 or RS256** JWT signing keys. The API verifies access tokens with jose and the project's JWKS. See [backend/AUTHENTICATION.md](backend/AUTHENTICATION.md) for the full issuer/audience/role validation contract.
3. Configure the Supabase Auth Site URL and exact allowed redirect URLs for the frontend origins you will use. Email/password login itself has no redirect callback, but confirmation/recovery links still require the correct project settings.
4. Set backend `AUTH_MODE=supabase`, `SUPABASE_URL`, `DATABASE_URL`, `HOST`, `PORT`, `ALLOWED_HOSTS` and `ALLOWED_ORIGINS`. Local Supabase-backed development may use `ALLOWED_ORIGINS=http://localhost:5173`. Production must list exact HTTPS origins, for example `https://packpilot.example.com`. Add each intended Vercel preview origin explicitly; do not allow wildcard preview domains. A frontend opened at `127.0.0.1` has a different origin from `localhost`.
5. Run database migrations. Assign ownership of existing data deliberately with `npm run members:bootstrap -- <company-id> <verified-Supabase-user-UUID>` from `backend/`. Signing in does not claim seeded data. Owners can add memberships through the existing API. New company creation through the UI assigns its creator as owner.
6. Run frontend and backend, sign in, verify company access, save a scenario and sign out. Validate real Supabase token renewal before deployment; automated tests use synthetic keys/transport and do not prove live project configuration.

## Sessions, company isolation and saves

The maintained `@supabase/supabase-js` client signs in, persists/refreshes its own session and broadcasts auth changes. Business profiles and results are kept in memory in authenticated mode; they are not persisted in the demo store. The API client sends `Authorization: Bearer <user access token>`, omits cookies and requests no caching. The Supabase publishable key is never used as the API bearer token.

On a 401, the client renews once (sharing concurrent refreshes) and retries with the same user's token. Repeated rejection or failed renewal clears the company UI and requests sign-in. It does not retry network-failed saves or switch identities during a retry. Sign-out clears the UI immediately and asks Supabase to end the local session. If provider sign-out fails, the UI stays signed out and reports the failure; retry sign-out/provider cleanup before leaving a shared device. Existing JWTs can remain valid until expiry, as documented in the backend auth contract.

Company choices come exclusively from the membership-filtered API, including all pages. The list includes the caller's `membershipRole`; only owners can edit company metadata in the UI. Server authorization remains authoritative. Changing company or identity unmounts its workspace, discards unsaved drafts and ignores late reads/calculations. Read failures, empty companies and absent catalogs are shown explicitly. The calculator result disappears immediately while inputs change, preventing old results being presented as current.

Profile, product, scenario and inventory saves are explicit. Saved scenarios retain independent input snapshots; loading another scenario or switching company discards unsaved edits. Saving an edited scenario marks it modeled. The simulator has its own draft and uses the backend comparison endpoint; same product/demand must be explicitly confirmed before a savings comparison is eligible. Null prices/costs remain unknown.

Inventory loads company stock records and calls the authenticated inventory calculator. It accepts explicit package demand, calendar/working days, lead time, safety stock, MOQ, review period, date and outstanding receipts. Unknown purchase orders are distinct from confirmed none. Saving an inventory record persists stock/lead time/MOQ/safety stock; demand, calendar assumptions and purchase orders remain an unsaved planning snapshot. No purchases are placed.

Existing product/catalog records load through the API. Product name/category/storage/shelf life and company metadata have edit forms; scenario snapshots expose volume, shares, material costs, labor, machine throughput/staffing/investment/maintenance/capacity. Full catalog creation, membership-management UI, conflict detection/audit history, inventory forecast persistence and import of legacy browser profiles remain separate work. Empty companies need catalog records created through the existing API before saving scenarios. Backend last-write-wins behavior is unchanged.

## Calculation policy

The backend is authoritative in authenticated mode: every packaging, comparison and inventory result comes from the API. Demo mode calls the same pure engines locally. No authenticated error substitutes a local calculation. Decimal strings retain monetary precision; only display formatting rounds euro totals to two decimals and cost/kg to three. Mass residuals display six kg decimals. Chart conversion to JavaScript numbers is visual only.

This supersedes the initial frontend's independent round-up packages and whole-cycle time policy. See [CALCULATIONS.md](CALCULATIONS.md) and [backend/README.md](backend/README.md). At 1.125 kg in the OG example, 1 kg can be packed and 0.125 kg remains unpackaged; the app does not show rounded package capacity as completed production. Machine-hours use continuous throughput. The exact 1,000 kg reference remains **800 / 300 / 200 packages; 1,300 total; €91 materials; €195 labor; €286 packaging operating cost; €0.286/kg**. Recurring costs and investment stay unknown until supplied; no savings/payback are invented.

## Validation

```sh
# Frontend, no backend installation or cloud credentials needed
npm ci
npm run typecheck
npm test
npm run build

# Backend checks and real HTTP frontend-client integration
npm ci --prefix backend
npm run db:generate --prefix backend
npm run typecheck --prefix backend
npm test --prefix backend
npm run build --prefix backend
npm run test:integration
```

Root tests cover the existing calculation/storage regressions, shared allocation policy, explicit demo saves, sign-in/out and expired sessions, bearer requests, refresh concurrency, account/company changes, authoritative API results, profile/scenario/inventory saves, loading/errors/empty access, key validation and prevention of implicit browser uploads. UI tests mock transport and chart geometry. The additional HTTP suite creates a temporary migrated SQLite database, generates ephemeral ES256 keys, uses actual Fastify/jose/Prisma and exercises the production frontend API client. It neither reads nor modifies the local development database. GitHub Actions runs the frontend, backend, HTTP integration and compiled staging rehearsal suites.

## Deployment still required

No merge or deployment is part of this phase. Before a public release, review the stacked PRs, configure the live Supabase project and frontend variables, test live login/refresh, bootstrap intended memberships, and configure exact API hosts/frontend origins and HTTPS. Vercel can host the static frontend using the existing SPA rewrite. The current Fastify/SQLite backend requires a separately hosted persistent filesystem and backups; it is not suitable for ephemeral Vercel function storage. A managed PostgreSQL migration, target-database validation, operational monitoring/rate limits and a chosen backend host remain separate deployment decisions.

## Recorded verification — November 18, 2026

- Frontend: formatting check, strict TypeScript check, **87 tests across 7 files**, and production build passed. App integration tests also run under React StrictMode.
- Backend: strict TypeScript check, **186 tests across 5 files**, and production build passed. Existing calculation-engine source and pure calculation tests are unchanged.
- Real HTTP frontend-client integration: **5 tests passed** against a temporary migrated SQLite database and ephemeral signed ES256 tokens, including real expired-token renewal and denied company access.
- Chromium desktop (1440 px) and mobile (390 px): explicit demo entry, OG TOFU totals, fractional mass residual, explicit scenario save, inventory calculation, exit and absence of page overflow/errors passed. Header overlap found during inspection was corrected.
- Chromium authenticated workflow: real frontend + Supabase SDK with intercepted synthetic Auth responses + actual Fastify/jose/SQLite passed sign-in, membership filtering, reference calculation, profile/scenario persistence, session restoration, sign-out and no implicit browser-data upload. Auth responses used real locally signed tokens accepted by the test backend; no live Supabase project was contacted.
- `git diff --check` passed. Test keys, databases, build output, screenshots and local environment files are not committed. The HTTP integration test is checked in and runs in CI; the browser checks above were local smoke checks, not a new Playwright CI suite.

Live Supabase login/refresh, deployed CORS/HTTPS and hosting behavior remain to be verified with the intended project and domains. Nothing has been merged or deployed by this task.

## Phase 4 integration fixes

Demand confirmation is bound to the exact compared input snapshots. A completed scenario save updates the editor only if that editor and draft are still current, so navigation or copying current inputs cannot be undone by a late response. The requested snapshot still saves on the server. See [RELEASE_REVIEW.md](RELEASE_REVIEW.md) for regressions and [STAGING_PLAN.md](STAGING_PLAN.md) for frontend environment variables and live acceptance checks.
