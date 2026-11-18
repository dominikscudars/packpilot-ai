# Authentication and company access

Phase 2 adds signed-token authentication and database-backed company authorization. It does not connect the existing frontend, create a Supabase project, merge a PR or deploy anything.

## Access rules

Every endpoint requires `Authorization: Bearer <access-token>` except `GET /api/v1/health` and CORS preflight. Calculators require authentication but accept independent caller-supplied data; they never load company records or save results implicitly.

| Operation                                                                                                          | Member                                                   | Owner |
| ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- | ----- |
| List/read companies the user belongs to                                                                            | Yes                                                      | Yes   |
| Read/create/edit/delete products, suppliers, materials, formats, machines, inventory and scenarios in that company | Yes                                                      | Yes   |
| Edit company name/category/country                                                                                 | No                                                       | Yes   |
| Delete a company (subject to existing data constraints)                                                            | No                                                       | Yes   |
| List/add/change/remove memberships                                                                                 | No                                                       | Yes   |
| Create a new company                                                                                               | Any authenticated user; creator becomes owner atomically | Same  |

Roles are company-specific, stored in `CompanyMembership`; JWT metadata cannot grant them. The JWT `sub` UUID identifies the user. Company lists are filtered before pagination. Nonmembers receive 404, whether the company exists or not; a member attempting an owner action receives 403. Invalid/missing/expired tokens receive 401 with a Bearer challenge. Tokens, request bodies, cookies and signing secrets are not logged or echoed.

Membership is checked against the database on every request, so removal/demotion takes effect for the next request even with an otherwise valid JWT. Ordinary operations already authorized and in flight may finish. Membership mutations and company owner operations run in transactions that first write-lock the company row and re-check the actor's current role. At least one owner must remain after membership changes. Company deletion removes memberships only when existing business-record constraints allow deletion.

Membership API (all owner-only):

- `GET /api/v1/companies/:companyId/memberships?limit=50&offset=0`
- `POST /api/v1/companies/:companyId/memberships` with `{ "userId": "<Supabase-user-UUID>", "role": "member" }` (or `owner`).
- `PATCH /api/v1/companies/:companyId/memberships/:userId` with `{ "role": "owner" }` or `member`.
- `DELETE /api/v1/companies/:companyId/memberships/:userId`.

An owner must obtain the intended recipient's authenticated user UUID through a trusted channel. This phase does not send invitations, resolve emails or use an Auth administrator key to enumerate users. Adding a membership does not create a Supabase account. `GET /api/v1/auth/me` returns the caller's verified `userId`.

## Supabase configuration

1. Create or select a Supabase project and enable the intended login provider in Supabase Auth (email/password is sufficient for the initial integration). Configure email confirmation according to the intended onboarding flow. Anonymous Supabase users are rejected by this API.
2. In Auth's JWT signing-key settings, use an **asymmetric ES256 or RS256 signing key**. Legacy HS256/shared-secret tokens are intentionally unsupported. Complete any signing-key transition before connecting clients.
3. Configure the Auth site URL and exact allowed callback/redirect URLs for your frontend. These Supabase redirect settings are separate from the backend CORS allowlist. The integrated frontend supports email/password sign-in; see [frontend setup](../FRONTEND_INTEGRATION.md).
4. Set the backend environment explicitly:

```dotenv
NODE_ENV=production
AUTH_MODE=supabase
SUPABASE_URL=https://your-project-ref.supabase.co
DATABASE_URL=file:/absolute/persistent/path/packpilot.db
HOST=0.0.0.0
PORT=3001
ALLOWED_HOSTS=api.your-domain.example
ALLOWED_ORIGINS=https://your-project.vercel.app
LOG_LEVEL=info
```

The API uses `jose` to fetch **only** `SUPABASE_URL/auth/v1/.well-known/jwks.json` and verify the signature. It requires issuer `SUPABASE_URL/auth/v1`, audience `authenticated`, a UUID subject, issued-at and expiration claims, `role: authenticated`, and a non-anonymous user. Expiry/not-before validation allows five seconds of clock tolerance; future issued-at or inverted lifetimes are rejected. Caller-supplied issuer/key URLs are never trusted. Unsupported algorithms, anon/service-role tokens and invalid signatures are rejected. JWKS retrieval has a five-second timeout, a 30-second retry cooldown and a ten-minute cache. Verification fails closed on missing keys or provider failures; it never falls back to local auth or token decoding.

No Supabase service-role key, secret API key, JWT signing secret or private key is required by this backend. A future browser client may use the Supabase project URL and publishable/anon client key to sign in, then send the user's **access token** to this API. The API rejects the anon key itself. Privileged keys must never be placed in `VITE_*`, frontend source, git or client bundles.

JWT verification validates tokens offline after public keys are cached. Supabase logout, account deletion or global session revocation may leave a previously issued access token valid until expiry; use suitably short access-token lifetimes. Company membership revocation is checked separately on every request. Immediate Auth-session revocation checks/introspection are not implemented in this phase.

## Allowed frontend origins and hosts

`ALLOWED_ORIGINS` is a comma-separated list of exact origins with no wildcard, path, trailing slash, query or fragment. Production requires HTTPS. Development permits HTTP only for localhost/loopback origins. Empty means no browser origin is allowed. Do not broadly allow all Vercel preview domains; explicitly add the preview origin you intend to use.

`ALLOWED_HOSTS` lists exact API hostnames without ports. Incoming Host headers are checked; credentials/path components are rejected. The server does not trust forwarded headers. Configure a future reverse proxy to preserve the expected public Host. CORS permits Authorization and Content-Type headers and GET/POST/PATCH/DELETE/OPTIONS methods; it does not enable cookie credentials. Preflight is unauthenticated, but the actual request always requires its token. CORS is not an authorization mechanism; non-browser callers still require valid tokens and memberships.

## Offline local development

Local mode uses generated ES256 keys and the **same JWT claim/signature verification and database authorization** as the Supabase path. It is not a bypass and accepts no identity header or hardcoded bearer secret. The issuer is distinct (`http://localhost/packpilot-development`), so local tokens cannot be used with Supabase mode.

From `backend/`, using Node 24:

```sh
cp .env.example .env
npm ci
npm run db:generate
npm run db:migrate
npm run db:seed
npm run auth:setup
npm run members:bootstrap -- og-tofu 11111111-1111-4111-8111-111111111111
npm run dev
```

The repeated UUID is an explicitly synthetic local development identity, not a real Supabase user. `auth:setup` generates keys with restrictive permissions in ignored `backend/.auth/` and preserves existing keys. If only one key file remains after an interrupted setup, remove that local key directory deliberately and rerun setup. Never commit or publish these files. All local users with access to the development private key can mint arbitrary local identities; local mode is suitable only for trusted development with synthetic data.

In another terminal, also from `backend/`:

```sh
PACKPILOT_TOKEN=$(npm run --silent auth:token -- 11111111-1111-4111-8111-111111111111)

curl http://127.0.0.1:3001/api/v1/auth/me \
  -H "Authorization: Bearer $PACKPILOT_TOKEN"

curl http://127.0.0.1:3001/api/v1/companies/og-tofu/scenarios \
  -H "Authorization: Bearer $PACKPILOT_TOKEN"

curl -X POST http://127.0.0.1:3001/api/v1/calculations/packaging-costs \
  -H "Authorization: Bearer $PACKPILOT_TOKEN" \
  -H 'Content-Type: application/json' --data-binary @examples/packaging-costs.json
```

Development tokens expire after one hour. Obtain a new one with the same command. Do not paste tokens into issues, PRs or logs. The token command prints the token only because it is a local credential-generation command; the server never prints it.

`AUTH_MODE` defaults to `supabase`. Missing Supabase settings fail startup. Local mode requires explicit `AUTH_MODE=local`, refuses `NODE_ENV=production`, refuses public bind addresses and accepts only local frontend origins. The example environment opts into local mode explicitly. The normal server never loads test fixtures. Automated tests generate ephemeral keys in memory, exercise real signatures/claims, apply real migrations to temporary databases and mock the JWKS HTTP transport only—no cloud credentials or live calls are needed.

## Existing data and initial ownership

The new additive migration leaves all existing companies and calculations unchanged. It intentionally creates **no memberships**. No user can claim an existing company just by logging in, knowing its ID or submitting an owner field. The regular demo seed does not grant access or change memberships.

For an existing company, a trusted administrator with database access runs:

```sh
npm run members:bootstrap -- <company-id> <verified-Supabase-user-UUID>
```

For real data, verify the recipient UUID belongs to the intended account before running the command. This command only works if the company has **no memberships at all**. Once an owner exists, use authenticated owner endpoints for additional access and handover. There is no bootstrap HTTP endpoint and no automatic first-user ownership assignment. Creating a new company through the authenticated API creates its initial owner in the same database write.

The Supabase Auth user store and the application's SQLite business database are separate. `CompanyMembership.userId` refers to the external Auth UUID without copying passwords or Auth secrets. There is no Auth-user foreign key across these stores and no automatic cleanup of deleted Supabase users yet.

## Remaining deployment requirements

Frontend integration is implemented; live Supabase login and public deployment remain unverified. Before deployment, configure and verify the real project/signing keys, test sign-in and token renewal end to end, bootstrap intended ownership for existing data, configure HTTPS and exact hosts/origins, and provide a suitable persistent database with backups. SQLite still requires a persistent filesystem and a single-instance deployment strategy; a PostgreSQL migration and target-database tests remain separate work. Add operational rate limits/monitoring and decide Auth-session revocation requirements before handling real customer data. Keep development keys, identities and databases out of production.

The integrated frontend uses Supabase sessions and authenticated API calls, with a separate explicit offline demo. See [FRONTEND_INTEGRATION.md](../FRONTEND_INTEGRATION.md). The backend calculation engines were not changed by authentication or frontend integration.

## Phase 4 staging safeguards

Production now requires an explicit absolute SQLite file URL on persistent storage; it cannot silently fall back to `dev.db`. Startup and health verify membership-table readiness. All responses carry `Cache-Control: no-store`. See the [staging runbook](../STAGING_PLAN.md) for exact frontend/backend variables, provider setup, initial ownership and recovery. The [release review](../RELEASE_REVIEW.md) records remaining dependency and operational risks; no live provider configuration has been validated.
