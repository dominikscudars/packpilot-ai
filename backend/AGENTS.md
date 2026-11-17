# Backend development rules

Read the root README.md, root AGENTS.md, PRODUCT_REQUIREMENTS.md and this directory's README.md. This package is an independent authenticated API; the frontend must not be altered unless the task requests integration.

- Use Node 24, strict TypeScript, Fastify, Zod and Prisma. Keep package-lock.json in this package up to date.
- Domain contracts/types live in `src/domain`; formulas in `src/calculation-engine`; HTTP handlers in `src/modules`; configuration in `src/config`. Pure engines must not import Fastify, Prisma or environment state.
- Use decimal strings and Decimal arithmetic for financial/mass/time quantities. Never use parseFloat or JS multiplication for money. Whole package counts must be safe integers.
- Keep quality status/source notes and nulls. Never fabricate missing quotes, dimensions, stock, staffing, prices or demand. Combined pricing is valid when a bag/label split was not reported.
- Preserve mass accounting: report any unfilled mass and mix deviations. Do not replace the documented allocation policy without explicit tests and documentation.
- Keep per-package and hourly labor mutually exclusive. Distinguish machine-hours/person-hours. Do not show savings/payback for incomparable demand, incomplete recurring costs or non-positive net benefit.
- Treat PATCH omissions as unchanged; creation defaults must not reset omitted values. Nested values are whole replacements.
- Keep company-scoped composite foreign keys, inventory CHECK, transaction boundaries and destructive-delete restrictions. Add migrations; never rewrite an already-deployed migration. The initial migration is pending review in this feature branch.
- Every company-data route must declare company-member or company-owner access. Do not replace membership checks with JWT metadata or a supplied company/user ID. All calculators require authentication.
- Use jose verification with fixed configured issuer/audience and asymmetric algorithms. Do not add HS256 fallback, unsigned decoding or an auth-disabled environment switch. Local auth is explicit, signed, loopback-only and forbidden in production; test keys stay in test helpers.
- Membership mutations must retain an owner and serialize on the company row before re-checking actor authorization. Preserve filtered listing, cross-company 404 responses and PATCH behavior.
- Never add service-role keys/signing secrets to frontend environment variables or source. Read AUTHENTICATION.md before changing CORS, hosts, signing keys or bootstrap behavior.
- Seed idempotently without overwriting edited records. Never commit `.env`, SQLite files/journals, secrets, real customer exports, node_modules or dist.
- Run `npm run typecheck`, `npm test`, `npm run build` in backend. Integration tests must apply migrations to a temporary real database. Run root checks when shared configuration changes.
- Update API examples, formulas and assumptions with behavior changes. Report only commands actually executed. Use feature branches and reviewed PRs; do not merge without instruction.
