# Backend verification

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
