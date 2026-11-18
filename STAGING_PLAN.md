# PackPilot AI staging plan

Prepared 18 November 2026. **Plan only: nothing has been merged, provisioned or deployed.** Read [RELEASE_REVIEW.md](RELEASE_REVIEW.md) for the reviewed revisions, fixes and remaining risks. This runbook targets a small, invited group using demonstration data. Real customer use needs the additional operational work listed below.

## Proposed hosting

| Component             | Proposed configuration                                                                                                    | Reason / constraint                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| React frontend        | Separate Vercel staging project, repository root, Node 24.x, Vite static build                                            | Build with `npm ci` then `npm run build`; output `dist`. `vercel.json` includes SPA routing.                  |
| API and business data | Paid Render **native Node** web service, root directory `backend`, one instance, persistent disk at `/var/data/packpilot` | Current Prisma provider is SQLite. A disk belongs to one service instance and prevents zero-downtime deploys. |
| Identity              | Separate Supabase staging project with email/password Auth and asymmetric signing keys                                    | Supabase stores identities; this release does **not** store business records in Supabase Postgres.            |
| Backups               | Consistent SQLite snapshots copied to a separately chosen, restricted off-host destination                                | A snapshot on the same disk does not protect against losing that disk.                                        |

Recommend a common EU region where available, with Render Frankfurt as the first candidate. Confirm region availability, account plans, disk size and budget before purchasing. Vercel Functions and ephemeral/free backend filesystems are unsuitable for this SQLite deployment. Changing to PostgreSQL or multiple API instances requires a separate migration and target-database tests.

Render documents [persistent disk availability and lifecycle](https://render.com/docs/disks), [web service setup](https://render.com/docs/web-services), and [Node version selection](https://render.com/docs/node-version). Files outside the mount are ephemeral. The disk is available to the running service, **not** its build, pre-deploy command or one-off jobs; migrations therefore run in the startup command. Expect a short maintenance interruption on redeploy.

## Decisions and access required from the owner

| Needed                     | Concrete action before an authorized deployment                                                                                                                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hosting choice and spend   | Approve or replace the proposed Vercel + paid Render service/disk + Supabase arrangement; choose EU region, disk capacity and budget. No subscriptions have been purchased.                                                                 |
| GitHub / Vercel account    | Choose the Vercel team and staging project; grant that team's GitHub integration access to `dominikscudars/packpilot-ai`.                                                                                                                   |
| Render account             | Choose workspace and billing plan; authorize repository access; configure one Node service and its disk.                                                                                                                                    |
| Supabase account           | Choose staging organization/project/region; configure Auth; obtain project URL and **publishable** key; create the intended test accounts.                                                                                                  |
| Stable addresses           | Choose the staging frontend/API hostnames. Provider subdomains suffice; custom domains additionally require DNS access.                                                                                                                     |
| Initial data and ownership | Choose an empty company created by the signed-in owner, or explicitly authorize the checked-in OG TOFU demonstration seed. Verify the intended owner's Supabase Auth UUID in the dashboard.                                                 |
| Recovery responsibility    | Choose an off-host backup destination, retention, recovery objectives and person responsible for alerts/restores. Proposed staging baseline: daily backups plus one before migrations, seven daily copies. This schedule is not configured. |
| Remaining risk             | Review the dependency findings and operational limitations in RELEASE_REVIEW.md before any public exposure.                                                                                                                                 |

Use provider dashboards or managed secret settings for credentials. Do not paste passwords, refresh/access tokens, service-role keys or deploy-hook URLs into chat, issues or PRs. The app needs no Supabase privileged key.

## Hold deployment automation

`vercel.json` sets `git.deploymentEnabled: false`, which [disables Vercel Git-triggered deployments](https://vercel.com/docs/project-configuration/git-configuration). It does not disable dashboard/CLI deployments or every external integration. Before connecting accounts, also leave Render auto-deploy off and inspect Vercel/Render project settings, deploy hooks and external automation. Importing a provider project can itself trigger its first deployment; do that only after explicit deployment authorization. No account settings were inspected or changed during this review.

After authorization, deploy only the fully reviewed combined revision. Keep automatic previews off until intentionally enabled in a separate reviewed change. This repository's CI only installs, tests and builds.

## Supabase staging setup

1. Create a separate staging project. Record its exact `https://<project-ref>.supabase.co` origin.
2. Enable email/password Auth; pre-create and confirm the invited testers. Disable public account signup and anonymous sign-ins for this staging exercise. The app has sign-in/out and session refresh, but no signup, invitation acceptance or password recovery UI. Use the Auth dashboard for account administration.
3. Configure an asymmetric **ES256 or RS256** signing key and verify it appears at `<project-url>/auth/v1/.well-known/jwks.json`. Legacy HS256 tokens are intentionally unsupported. See [Supabase signing keys](https://supabase.com/docs/guides/auth/signing-keys).
4. Set the Auth Site URL to the stable staging frontend origin. Keep any redirect allowlist exact and limited to intended staging URLs. Email/password sign-in itself does not need an OAuth callback route; don't invent a callback route the app doesn't implement. See [password authentication](https://supabase.com/docs/guides/auth/passwords).
5. Obtain the public `sb_publishable_…` key. The frontend rejects legacy JWT keys as well as secret keys; use a publishable key. Never use a secret or service-role key in Vercel's frontend variables. See [Supabase API key types](https://supabase.com/docs/guides/getting-started/api-keys).
6. Record the **actual intended user's Auth UUID**, after verifying their account. Membership is stored in the application's SQLite database; creating a Supabase user grants no access to an existing company by itself.

The server fixes issuer to `<project-url>/auth/v1`, audience to `authenticated`, checks signature/expiry/claims through jose and fetches public JWKS. It never trusts a token's company/role metadata. JWTs are locally verified, so a previously issued token may remain valid until expiry after Auth logout/deletion. Choose a suitable token lifetime and revocation policy; remove company membership immediately when revoking company access. Test actual refresh/key rotation before relying on the deployment.

## Environment variables and commands

### Vercel staging frontend

Use a **separate staging project** so its stable deployment URL can be used without connecting production data. Set these for every environment actually used by that project (Vercel's Production label may mean this staging project's stable URL; Preview needs its own explicit configuration). Rebuild after changing them: Vite embeds public values at build time.

| Variable                        | Value                                                              |
| ------------------------------- | ------------------------------------------------------------------ |
| `VITE_API_URL`                  | `https://<staging-api>.onrender.com` — origin, no `/api/v1` suffix |
| `VITE_SUPABASE_URL`             | `https://<staging-project-ref>.supabase.co`                        |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Staging project's public publishable key                           |

Root directory: repository root. Node: 24.x. Install: `npm ci`. Build: `npm run build`. Output: `dist`. Do not set `DATABASE_URL`, signing secrets or privileged Supabase credentials here. Never publish the Vite development server.

### Render backend

Root directory: `backend`. Runtime: native Node. Instance count: **one**. Disk mount: `/var/data/packpilot`. Auto-deploy: **off**. Health check: `/api/v1/health`.

| Variable          | Staging value                                                                     |
| ----------------- | --------------------------------------------------------------------------------- |
| `NODE_VERSION`    | `24.22.1` (explicit tested major; recheck supported security patch at deployment) |
| `NODE_ENV`        | `production`                                                                      |
| `AUTH_MODE`       | `supabase`                                                                        |
| `SUPABASE_URL`    | Same exact project origin as the frontend                                         |
| `DATABASE_URL`    | `file:/var/data/packpilot/staging.db`                                             |
| `HOST`            | `0.0.0.0`                                                                         |
| `PORT`            | `10000`, or the provider's assigned service port                                  |
| `ALLOWED_HOSTS`   | `<staging-api>.onrender.com` — exact hostname, no scheme, path or port            |
| `ALLOWED_ORIGINS` | `https://<stable-staging-frontend>.vercel.app` — exact origin, no trailing slash  |
| `LOG_LEVEL`       | `info`                                                                            |

Build command:

```sh
npm ci --include=dev && npm run db:generate && npm run build
```

Start command:

```sh
npm run start:staging
```

Startup applies checked-in migrations with `npm run db:migrate`, then runs the compiled API. Never run seed/bootstrap automatically on startup. Keep the CLI dependencies installed: migrations and administrative scripts need Prisma/tsx. The audit therefore includes those installed packages; see RELEASE_REVIEW.md.

Production refuses omitted/relative database paths, and startup refuses an unmigrated database. The path check cannot verify that a provider disk really backs that directory: confirm the mount in the service dashboard and test persistence. Health returns 503 when the membership table cannot be queried; it is database readiness, **not** an end-to-end Supabase availability check. API responses have `Cache-Control: no-store`.

Reserve the provider project/service names and stable origins during authorized setup. Set the API's exact allowed frontend origin before the first user test; set the frontend API URL once the service URL is assigned. Verify the real Host used by the health checker/reverse proxy. Add only a concrete required hostname if necessary; do not disable Host validation or trust arbitrary forwarded headers.

Multiple approved origins/hosts are comma-separated. Add a particular Vercel preview origin only when deliberately testing that deployment; `*.vercel.app` is rejected. Supabase's redirect list and the API's CORS list are separate settings. Non-browser requests still require authentication/membership regardless of Origin.

## Initial company ownership

For a blank workspace, the signed-in user can choose **Create company** and receives the owner membership atomically. Full catalog creation is currently API-only; a blank company needs products/materials/formats before scenarios can be saved. No browser demo profile is automatically uploaded.

To use the checked-in, explicitly labeled OG TOFU reference data instead, first authorize that seed for staging. From the **running backend service shell**, with the persistent disk mounted and the configured production environment:

```sh
npm run db:seed
npm run members:bootstrap -- og-tofu <verified-real-Supabase-user-UUID>
```

Replace the placeholder; verify the UUID belongs to the intended person. Never use the synthetic `11111111-1111-4111-8111-111111111111` local-development identity in real staging. Seeding is idempotent and preserves edits but grants **no** memberships. Bootstrap only works when the company has no memberships at all; subsequent changes use authenticated owner membership endpoints. Do not implement automatic first-login ownership or use a one-off job without access to the disk.

The 80/15/5 mix and prices in the reference remain documented assumptions, not new verified customer facts. Use separate synthetic companies/users for isolation tests.

## Backups, persistence and rollback

After building, run in the backend service shell with the same `DATABASE_URL`:

```sh
npm run db:backup -- /var/data/packpilot/backups/<unique-timestamp>.db
```

Replace the filename placeholder. The command uses Node 24's SQLite backup API for a consistent live snapshot (including WAL transactions), creates a new file with restrictive permissions, refuses to overwrite an existing path and checks database integrity. It does not upload, encrypt or schedule anything. Copy completed snapshots to the chosen restricted off-host storage and verify restoration **before** pruning older backups. Protect membership records and business data in those copies.

Do not copy just the live `.db` file while it has active WAL writers. Render's filesystem snapshots are an extra recovery layer, not a substitute for database-consistent backups and restore tests. Check the provider's current [disk backup guidance](https://render.com/docs/disks).

Restore rehearsal: copy a snapshot into an **isolated** database/service with the same schema-compatible release and staging Auth project; verify profile/scenario values, owner membership, other-company isolation and the €286 reference. Do not point a test restore at the active database.

For an actual rollback/restore, schedule a maintenance window, stop writers, preserve the current database and its journal/WAL files, validate the chosen snapshot and replace the database while the API is stopped. Handle old sidecars as part of that offline replacement so they cannot be replayed onto the restored file. Start the approved schema-compatible release, apply only its reviewed migrations, then verify readiness and access. Reverting code alone does not revert a schema migration. Never use `prisma migrate reset` or `db push` as a release recovery procedure. Define acceptable data loss and downtime before authorizing a real restore.

## Review, release order and acceptance gates

PRs are stacked: **#1 → #2 → #3 → #4 → release-readiness fixes**. After explicit merge authorization, preserve their ancestry (merge commits are simplest), retarget each dependent PR to `main` after its parent lands and inspect the resulting diff. Rerun all checks on the final combined commit. Do not release the intermediate unauthenticated Phase 1 backend. No PR has been merged by this task.

Offline checks from the repository root, using Node 24 and no cloud credentials:

```sh
npm ci
npm ci --prefix backend
npm run db:generate --prefix backend
npm run typecheck
npm test
npm run build
npm run typecheck --prefix backend
npm test --prefix backend
npm run build --prefix backend
npm run test:integration
npm run test:staging
```

The staging rehearsal starts the compiled server in `NODE_ENV=production` / `AUTH_MODE=supabase`, with ephemeral signed tokens and **test-only JWKS transport**. It exercises migrations, owner bootstrap, exact CORS, cache headers, restart persistence, live backup, overwrite refusal and isolated restore. Production source has no mock-auth bypass. This is not proof that a real Supabase or Render project is correctly configured.

After separate deployment authorization and account setup, verify all of the following against the real staging URLs:

- Sign in, reload, refresh/expire the session, and sign out with real Supabase accounts. Test desktop and narrow viewport navigation and direct SPA links.
- Owner/member/outsider access: missing/invalid/expired tokens are rejected; member cannot change ownership; outsider cannot read or mutate another company's IDs; all calculators require tokens. Removing membership takes effect on subsequent requests.
- Load and explicitly save company/scenario/stock records, reload and restart the API, and confirm persistence. A private browser and a browser containing an old local profile must not silently create/upload company data.
- Exact reference: 800/300/200 packages, 1,300 total, €91 material, €195 labor, €286 operating cost, €0.286/kg. Fractional production shows unfilled mass; unknown equipment costs do not become zero savings. Changing comparison inputs requires applicable demand confirmation.
- Inventory distinguishes unknown outstanding purchases from confirmed none; loading/errors remain visible without demo fallback.
- HTTPS, Host validation, exact CORS, no-store responses and redacted logs work at the provider edge. No privileged key appears in the frontend build or environment.
- Create an off-host backup and rehearse a restore; assign alerts for availability, disk capacity and backup failures. Confirm redeploy downtime is acceptable.

Before real customer/public launch, add operational rate limiting and monitoring, define token/session revocation and Auth-user cleanup, and decide whether last-write-wins editing is acceptable. Membership management and complete catalog onboarding still require API/admin tooling. Review residual dependency advisories before opening access beyond invited testers.
