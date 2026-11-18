# Phase 4 release readiness review

Reviewed 18 November 2026. **No merge or deployment performed.** This review covers the combined stack through Phase 3, plus the fixes on `fix/release-readiness`. The proposal is controlled staging with invited testers; live provider setup and acceptance tests remain outstanding. See [STAGING_PLAN.md](STAGING_PLAN.md) for exact commands, variables, persistence, ownership and account decisions.

## Reviewed scope

| PR                                                                                        | Head revision                              | Base                       |
| ----------------------------------------------------------------------------------------- | ------------------------------------------ | -------------------------- |
| [#1 MVP foundation](https://github.com/dominikscudars/packpilot-ai/pull/1)                | `966e165f99dd8606682ddef5c6bf34a2b5ba47a4` | `main`                     |
| [#2 Backend foundation](https://github.com/dominikscudars/packpilot-ai/pull/2)            | `6cf8b42e251e42f6bd5a57abf68506786cf96475` | `feat/mvp-foundation`      |
| [#3 Authentication/company access](https://github.com/dominikscudars/packpilot-ai/pull/3) | `fe6762a11f72dc2fee87f1d24605b5a26309ee2e` | `feat/backend-foundation`  |
| [#4 Frontend integration](https://github.com/dominikscudars/packpilot-ai/pull/4)          | `04d246fbcb26892591086d5cb8a7347e874214f4` | `feat/auth-company-access` |

All four were open drafts, mergeable, with no review threads when inspected. They form an ancestor chain. The review included repository instructions/documentation, combined frontend/API contracts and calculation behavior, authentication and company authorization, configuration, migrations, persistence and CI. Existing tests were retained. This is an engineering review with targeted regressions, not an independent penetration test or a claim that all possible defects are excluded.

## Blockers fixed in this branch

| Finding                                                                                                                                                       | Result and regression evidence                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A delayed scenario save could replace a newer draft after leaving/returning to the editor, or after copying current inputs while a save was in flight.        | Apply the saved response only while the original editor and draft are still current. The explicitly requested server save still completes and remains in the saved list. Both UI regression cases failed before their fixes.                                              |
| Same-product/demand confirmation survived changes to the compared inputs.                                                                                     | Bind confirmation to the exact pair of input snapshots. Changed inputs are unconfirmed; a comparison cannot carry an unrelated previous confirmation. Regression failed before the fix.                                                                                   |
| A positive-share format without assigned equipment could silently contribute zero recurring costs and incomplete investment, enabling misleading comparisons. | Keep recurring cost/investment unknown and explain the missing assignment. Material and per-package labor results remain available. Zero-share unassigned formats do not invalidate known costs. Regression failed before the fix; exact OG TOFU totals remain unchanged. |
| Production could omit DATABASE_URL and create a working-directory development database on ephemeral storage.                                                  | Require an explicit absolute SQLite file URL in production, reject relative/memory/parameterized URLs. Development defaults remain available. Regression cases failed before the fix; a provider mount must still be verified.                                            |
| Health used SELECT 1, which also succeeds on an empty, unmigrated SQLite file.                                                                                | Startup and health query the membership table. The compiled server refuses an unmigrated database; health reports a generic 503 when it cannot query it. Real empty-database regression failed before the fix.                                                            |
| Authenticated responses had no explicit shared-cache protection.                                                                                              | Set `Cache-Control: no-store` before authentication/Host checks, including errors. Header regression failed before the fix.                                                                                                                                               |
| Prisma 6.19.0 pulled an affected Effect version.                                                                                                              | Pin Prisma/client together to 6.19.3; regenerate client. This removes the Effect advisory without an ORM major upgrade. Remaining advisories are recorded below.                                                                                                          |

The unassigned-equipment correction deliberately changes the shared calculation engine in this release-readiness phase; it is not an authentication-only change. It preserves missing-value policy and the original reference inputs. No rounding/allocation formula was replaced.

## Security and integration conclusions

- jose verifies asymmetric signatures, configured issuer/audience and time/identity claims. Production cannot enable local auth. Tests generate their own keys; the production server has no test identity switch.
- Company lists are membership-filtered. Company data routes declare member/owner access; foreign-company IDs are hidden with 404, owner-only operations return 403 to members, and company-scoped foreign keys reject cross-company relationships. Calculators require authentication and operate on supplied snapshots without reading another company's records.
- Membership changes serialize before rechecking actor authorization and preserve an owner. Bootstrap is an explicit database-admin action for a company with no memberships, not a public claim endpoint.
- The frontend sends tokens and handles refresh/expiry, isolates identity/company workspaces and separates explicit demo data from authenticated records. It never silently uploads legacy browser profiles or substitutes demo results for API failures.
- Authenticated calculations use the backend's mass-preserving policy. Existing frontend legacy tests remain, but current demo and authenticated results share the authoritative pure engine. OG TOFU remains 800/300/200 packages; 1,300 total; €91 materials; €195 labor; €286 operating cost; €0.286/kg.
- Limits, strict request schemas, generic internal errors, exact hosts/origins and token-log redaction remain in place. CORS does not replace authorization. JWT logout/deletion revocation is not instantaneous; membership removal is checked on subsequent requests.

## Validation

Executed locally on Node 24, without live cloud credentials:

| Check                                                              | Result                                                                                                                                                                               |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Frontend typecheck, tests, production build                        | Passed; 90 tests                                                                                                                                                                     |
| Prisma client generation, backend typecheck, tests, compiled build | Passed; 195 tests                                                                                                                                                                    |
| Real HTTP frontend-client/API integration                          | Passed; 5 tests                                                                                                                                                                      |
| Compiled production-mode staging rehearsal                         | Passed; 2 tests                                                                                                                                                                      |
| Total automated tests                                              | **292 passed**                                                                                                                                                                       |
| Browser integration check                                          | Passed: Chromium + real signed JWT/API/SQLite; mocked Supabase transport; login, filtering, exact reference, profile/scenario save, session restoration, sign-out and no demo upload |

The new staging suite checks startup refusal before migrations, migrated production-mode operation, explicit owner bootstrap, CORS/cache behavior, restart persistence, a consistent live backup, overwrite refusal and isolated restore of records/membership/reference calculations. CI now runs it after building the backend. It does not contact real Supabase, Vercel or Render, and does not prove their future settings correct.

## Dependency audit and remaining risk

Audit snapshot after the Prisma patch, 18 November 2026. Counts are npm's affected-package counts, including transitive ancestors; they are not counts of distinct independently exploitable issues.

| Installation | Full audit | `npm audit --omit=dev` |
| ------------ | ---------- | ---------------------- |
| Frontend     | 6 high     | 0                      |
| Backend      | 8 high     | 3 high                 |

- **Fixed:** [Effect GHSA-38f7-945m-qr2g](https://github.com/advisories/GHSA-38f7-945m-qr2g), affected below 3.20.0. Prisma 6.19.3 resolves Effect 3.21.0.
- **Remaining:** [picomatch GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf), ReDoS with crafted glob patterns, through Vite/Vitest/fdir/tinyglobby. The advisory lists versions through 4.0.7 as affected and no patched release; npm's latest was 4.0.7 when checked. Application requests do not enter this glob API. Build/test patterns are repository-controlled; serve only the static frontend build and compiled backend, never a public Vite development server. Track the upstream fix; do not treat suggested major downgrades as a verified remedy.
- **Remaining:** [deepmerge-ts GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx), denial of service with crafted recursive object graphs. `@prisma/config@6.19.3` pins 7.1.5; the advisory's patch is 8.0.0. Prisma imports it as the merger for trusted CLI configuration. This repo has no caller-supplied Prisma configuration or HTTP path into that merger. It is nevertheless **installed in the backend graph and reported by the production audit**, so this review does not claim zero production findings. npm proposes a Prisma major upgrade; forcing a deepmerge major override would bypass Prisma's declared version. Both require separate compatibility work. Track a supported patch or validate a targeted upgrade before broader release.

The staging build intentionally retains CLI tooling for migration/administration, so these installed dependencies cannot simply be labeled absent from the deployed service. The restricted inputs above reduce identified exposure; they do not erase the advisories. No `npm audit fix --force`, forced major override or audit suppression was used. Re-audit at release time and require the release owner to review the residual risk before exposing staging. These are documented follow-ups, not a clean security audit.

## Remaining deployment and product requirements

- Account authorization, hosting/billing/region choices, real Supabase asymmetric signing keys and invited users, stable URLs and exact CORS/hosts are not configured by this task.
- SQLite requires a real persistent disk, one instance, backup ownership/off-host retention and a tested restore. The new backup command creates and verifies snapshots; it does not schedule or upload them.
- Real sign-in/refresh/key rotation, provider health checks, edge/cache behavior, restart/redeploy durability and off-host recovery need live acceptance testing after deployment is separately authorized.
- Rate limiting, availability/disk/backup monitoring, a session revocation policy and cleanup of deleted Auth users remain prerequisites for real customer/public launch. No privileged Supabase credential belongs in the frontend.
- Full catalog onboarding, membership management UI, signup/recovery UI and audit/conflict history remain unfinished. Existing writes use last-write-wins semantics across clients. A blank company requires API catalog setup; inventory forecasts and purchase-order assumptions are not persisted as a complete planning snapshot.

The next authorized step is to review the draft fixes and choose the staging accounts/hosting details in STAGING_PLAN.md. Merging and deploying remain separate decisions.
