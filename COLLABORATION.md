# PackPilot shared work guide

This is the common starting point for Dominik, ChatGPT/Codex and Claude. Both AIs must read it at the start of a task and update relevant status and handoff notes when their work changes them. Repository files and PRs carry context between tools; the AIs do not automatically see each other's chats or unpushed edits.

## Three participants

| Participant             | Responsibility                                                                                                                                                                         |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dominik — product owner | Sets priorities, supplies research and acceptance criteria, decides hosting/account/budget questions and authorizes merges and releases. Assigns or resolves overlapping tasks.        |
| ChatGPT / Codex         | Implements and validates assigned work, records its branch and scope, opens focused PRs and leaves reproducible handoffs. Can review Claude's work when requested.                     |
| Claude                  | Implements and validates assigned work under the same rules, records its branch and scope, opens focused PRs and leaves reproducible handoffs. Can review Codex's work when requested. |

Neither AI has permanent ownership of frontend or backend. Assign one owner to each task and one person or AI to any shared file being edited at the same time. An assignment to one AI is not an assignment to both. Additional human contributors should use the same task and handoff format.

## Start every task

1. Read the user's current request, this file and `AGENTS.md`. Read the scoped instructions and relevant product/API/calculation documentation before changing behavior.
2. Run `git status --short --branch` and `git fetch origin`. Inspect remote branches, open PRs, their base/head commits and their changed files. Preserve uncommitted work; do not reset or overwrite it to get a clean checkout.
3. Check the active work table below and newer PR descriptions for another contributor's claim. A dated row is not proof that a task remains active or available. Check with Dominik only if an actual scope conflict cannot be resolved from the repository.
4. Record the task, owner, base commit, branch, intended files and acceptance criteria in a focused draft PR as early as practical. For Codex use `codex/<task>` and for Claude use `claude/<task>` for new implementation branches; keep existing branch names intact. Use a separate checkout/worktree when work is already in progress locally.
5. If a task depends on an unmerged PR, branch from that PR's current head and target that branch in your PR. State the dependency. Do not assume `main` contains the working application.

## Avoid overwriting each other

- One task branch has one writer. Do not push to another contributor's branch, force-push, rewrite shared history or discard their edits without explicit authorization.
- Before touching shared models, API contracts, migrations, calculation engines, package manifests/lockfiles or shared CSS, check other open PRs for overlapping work. Split the work into non-overlapping files or agree on a handoff before editing the same area.
- Fetch again before publishing. If the remote branch moved, inspect the new commits and reconcile them; do not replace them with your local copy. Resolve conflicts by understanding both changes, then rerun affected checks.
- Update this guide in your own PR and preserve other contributors' rows. Branch-local copies and task claims are advisory, not an atomic lock. Inspect the latest open PRs as well as this file; Dominik resolves simultaneous claims. Once this guide is merged, use its default-branch copy plus newer PR handoffs.
- Keep changes focused. Do not bundle a redesign, dependency upgrade, auth rewrite or calculation change into an unrelated task.
- Do not merge or deploy merely because a PR is ready. Follow the user's current authorization. A demo deployment does not authorize a production backend release, paid hosting purchase or merging the PR stack.

## Current checkpoint

Verified 19 November 2026 against GitHub and the local checkout. Refresh these facts before acting.

- Repository: [dominikscudars/packpilot-ai](https://github.com/dominikscudars/packpilot-ai).
- Latest combined application branch: `feat/modern-interface`, commit `9f7130205ab2f536d27963f455a7a5c6916d8db8`. It contains the earlier development phases. `main` still contains project documentation rather than the application.
- PRs #1–#6 were open when checked. The dependency order below matters; do not merge or retarget the stack without reviewing its current state.

| PR                                                          | Head branch                 | Base branch                 | Scope                                          |
| ----------------------------------------------------------- | --------------------------- | --------------------------- | ---------------------------------------------- |
| [#1](https://github.com/dominikscudars/packpilot-ai/pull/1) | `feat/mvp-foundation`       | `main`                      | Initial frontend and calculations              |
| [#2](https://github.com/dominikscudars/packpilot-ai/pull/2) | `feat/backend-foundation`   | `feat/mvp-foundation`       | API, persistence and backend calculators       |
| [#3](https://github.com/dominikscudars/packpilot-ai/pull/3) | `feat/auth-company-access`  | `feat/backend-foundation`   | Supabase token verification and company access |
| [#4](https://github.com/dominikscudars/packpilot-ai/pull/4) | `feat/frontend-integration` | `feat/auth-company-access`  | Authenticated frontend/API integration         |
| [#5](https://github.com/dominikscudars/packpilot-ai/pull/5) | `fix/release-readiness`     | `feat/frontend-integration` | Release fixes and staging plan                 |
| [#6](https://github.com/dominikscudars/packpilot-ai/pull/6) | `feat/modern-interface`     | `fix/release-readiness`     | Modern interface and visualizations            |

While this guide is unmerged, find it on `docs/team-coordination`, based on `feat/modern-interface`. Both AI sessions should read that branch's guide and instruction entry points before starting. A branch that does not contain these files will not discover them automatically.

### Active work and next decisions

| Task                                        | Owner                                                  | Status / scope                                                                                                                                                                                                                                                                                                                                                                                                        | Next action                                                                                                                                                                                                                    |
| ------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Shared coordination guide                   | Codex                                                  | Documentation on `docs/team-coordination`; `COLLABORATION.md`, `AGENTS.md`, `CLAUDE.md`                                                                                                                                                                                                                                                                                                                               | Review the documentation PR; preserve this guide in subsequent work.                                                                                                                                                           |
| Publish the current frontend demo on Vercel | Codex, with Dominik completing account authorization   | Requested by Dominik. CLI device login was started; successful authorization and deployment have not been confirmed. No application code change required.                                                                                                                                                                                                                                                             | Verify CLI authentication and existing Vercel projects before creating anything. Deploy the agreed frontend demo from the combined application branch and report a verified URL. Never put login codes or tokens in this file. |
| Per-format packaging cost per kg            | Claude                                                 | Merged to `main` via `claude/release-to-main`. Was `claude/format-unit-economics`, based on `docs/team-coordination` `bc65851`. Adds per-format packaging cost and cost per packed kg to the backend engine output and the results table. Files: `backend/src/calculation-engine/packaging.ts`, `backend/tests/calculations.test.ts`, `backend/README.md`, `src/components/ApiResults.tsx`, `src/tests/App.test.tsx`. | Done. Possible follow-up: optional selling price per format to show margin.                                                                                                                                                    |
| Full authenticated staging                  | Dominik for decisions; implementation owner unassigned | Supabase setup, persistent API hosting, initial company ownership and backups remain pending                                                                                                                                                                                                                                                                                                                          | Follow `STAGING_PLAN.md`; confirm provider/account decisions and release scope before provisioning.                                                                                                                            |

The frontend demo can run without cloud credentials. Authenticated company data requires Supabase Auth plus a separately hosted API with persistent storage. Vercel frontend hosting alone does not provide that backend. On 19 November 2026 Dominik authorized Claude to approve and merge PRs. Claude merged the #1–#8 stack into `main` through `claude/release-to-main` and re-enabled Vercel Git deployments of `main`. Future work branches from and targets `main`.

## Product and security invariants

- Preserve exact OG TOFU reference results: 800 / 300 / 200 packages; 1,300 total; EUR 91 materials + EUR 195 labor = EUR 286; EUR 0.286/kg. Preserve the existing reference tests and documented input assumptions.
- The backend calculation engine is authoritative for the integrated UI and current demo. Preserve its mass accounting and documented rounding; do not silently restore the older frontend rounding policy.
- Missing financial inputs stay unknown, not zero. Keep per-package and hourly labor mutually exclusive. Never invent supplier, inventory, compliance, savings or ROI claims.
- Keep Supabase tokens verified server-side and company memberships authoritative on all company-data endpoints. Protect calculators too. Keep local/test authentication separate from production.
- Keep demo browser storage separate from authenticated records; never silently upload browser profiles.
- Never commit secrets, login codes, privileged Supabase keys, `.env` files, customer records, local databases, dependencies or build output. Privileged credentials never belong in frontend code or `VITE_*` variables.
- Preserve offline local development and automated tests. Use Node 24 and the checked-in lockfiles.

## Validation and handoff

Follow `AGENTS.md`, scoped instructions and `.github/workflows/ci.yml`. Run the existing root checks before reporting success:

```sh
npm run typecheck
npm test
npm run build
git diff --check
```

For frontend source changes also run `npm run format:check` and inspect affected desktop/mobile flows. For backend changes, follow `backend/AGENTS.md` and run Prisma generation, typecheck, tests and build from `backend/`. For changes crossing the API boundary or deployment configuration, run the relevant root `test:integration` and `test:staging` suites, including their documented prerequisites. Add meaningful regression coverage for changed behavior; documentation-only changes do not need new tests.

Every handoff must distinguish checks actually run from prior evidence or checks still pending. Do not label code merged, deployed or production-ready based on a local build.

Use this template in the PR description or handoff section of this file:

```text
Task / owner:
User-requested outcome and acceptance criteria:
Status: in progress | blocked | ready for review | merged | deployed
Base branch + commit:
Work branch + latest commit + PR:
Files / areas owned:
Changes made and why:
Checks actually run + results:
Known limitations / blockers:
Next action + owner:
Merge / deployment authorization and scope:
```

## Documentation map

- `AGENTS.md`: shared engineering instructions; `CLAUDE.md`: Claude entry point.
- `README.md`, `PRODUCT_REQUIREMENTS.md`: purpose, approved scope and research context.
- `CALCULATIONS.md` and the formulas/rounding section of `backend/README.md`: formulas and assumptions.
- `FRONTEND_INTEGRATION.md`: frontend sessions, API integration and public environment variables.
- `backend/AGENTS.md`, `backend/README.md`, `backend/AUTHENTICATION.md`: backend development, setup, auth and memberships.
- `RELEASE_REVIEW.md`, `STAGING_PLAN.md`: review evidence, outstanding risks and staging requirements.
