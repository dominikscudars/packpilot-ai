# Phase 2 authentication verification

Executed locally on November 17, 2026 with Node.js 24.22.1.

- Prisma client generation passed; the additive company-membership migration applied successfully to the existing development database. Original calculation/business tables and inputs were preserved.
- Backend `npm run typecheck`, `npm test` (**186 tests across 5 files**), and `npm run build`: passed.
- Frontend `npm run typecheck`, `npm test` (**44 tests**), and `npm run build`: passed. No frontend source, calculation-engine source or pure calculation tests changed.
- Auth tests generate temporary signing keys and test real JWT signatures/claims. They cover missing/malformed/expired tokens, wrong issuer/audience, unknown keys, unsupported algorithms, anonymous/service-role claims, every company route, calculators, filtered lists, membership roles/revocation, final-owner protection, bootstrap restrictions and exact-origin CORS.
- Supabase verification tests mock only the configured JWKS HTTP transport and verify signed tokens using jose. No live Supabase credentials, project or service calls were used.
- `auth:setup`, initial-owner bootstrap and local token generation ran successfully. Signing keys are confined to ignored `.auth/`; no tokens or private keys were printed during smoke verification or committed.
- Started the compiled server and checked actual HTTP responses: public health 200; missing token 401; other-company access 404; authorized company read 200 with the expected CORS header; authenticated reference calculation 200 with €286; unapproved origin 403. Graceful shutdown completed.
- Starting the compiled server with production environment and local authentication exited unsuccessfully as required.
- `git diff --check`: passed. New-file staging is also checked before commit.

Not performed: live Supabase project setup/sign-in/refresh testing, public deployment, frontend authentication integration, PostgreSQL execution or Auth-session introspection. Configure and validate those requirements before production use; see AUTHENTICATION.md. No PR was merged and no service was deployed.

---

# Phase 1 verification history

Executed locally on November 17, 2026 with Node.js 24.22.1.

- Installed Fastify, Zod, Decimal.js, dotenv, Prisma/client and TypeScript/Vitest tooling; backend package-lock.json is included.
- `npm run db:generate`: generated Prisma client successfully.
- Initial migration: applied successfully to the local SQLite database. Automated integration tests independently apply the checked-in migration to a fresh temporary database.
- `npm run db:seed`: ran successfully twice. Integration tests verify that re-seeding preserves edited data and does not duplicate scenarios.
- Backend `npm run typecheck`: passed.
- Backend `npm test`: **60 tests passed** in 3 files.
- Backend `npm run build`: passed.
- Root `npm run typecheck`, `npm test` (**44 frontend tests**), and `npm run build`: passed.
- `git diff --check`: passed.
- Started the compiled `dist/src/server.js` process, then made actual HTTP requests to health, persisted scenario reads, packaging costs, scenario comparison and inventory planning. All three checked-in JSON examples returned 200. The reference returned 1,300 packages and €286; the explicitly synthetic comparison returned €50 monthly net savings and 20-month payback; the inventory example returned a 2,000-package order. A request carrying an external Origin was rejected with 403. The server shut down via SIGTERM.

Coverage includes exact OG TOFU monetary outputs and cycle-derived time, multiple formats/machines/operators, mass feasibility and explicit residuals, decimal boundaries, unknown values, invalid input, mutually exclusive labor methods, comparable demand, recurring machine costs, non-positive savings, inventory coverage/MOQ/receipts, relational integrity, PATCH omission preservation, seed idempotence and local-demo access restrictions.

The SQLite schema, including composite foreign keys and the inventory CHECK, was exercised through real Prisma queries. This is not a claim of PostgreSQL, production deployment, authentication, tenant authorization, frontend/API integration or pilot user acceptance testing. No public deployment was performed. GitHub Actions is configured to repeat both packages' checks; remote CI status is separate from these local results.
