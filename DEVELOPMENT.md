# Developing PackPilot AI

Use Node.js 24 LTS (see `.nvmrc`) and npm. The repository contains a standalone frontend; no secrets or backend service are needed.

```sh
git clone https://github.com/dominikscudars/packpilot-ai.git
cd packpilot-ai
# For this initial implementation, until its PR is merged:
git switch feat/mvp-foundation
npm ci
npm run dev
```

Open the URL printed by Vite (normally http://localhost:5173). Browser local storage automatically persists valid edits under `packpilot.workspace.v1`; each browser has its own copy. The first visit loads `src/demo/ogTofu.ts`. To reset deliberately, remove that key in your browser's developer tools and reload; this discards local inputs. The simulator's “Copy current inputs” button replaces only the alternative with current-operation inputs.

## Checks

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

`npm test` runs Vitest once; `npm run test:watch` reruns during development. Tests cover formulas, validation, persistence and real dashboard/simulator integration. Recharts rendering is mocked only in component tests; those tests do not certify browser chart geometry. The production build is written to `dist/`. GitHub Actions runs install, checks, tests and build for pushes and pull requests. Vercel SPA rewrite configuration is included, but this task does not deploy the app.

## Project map

```text
src/
  components/    shared UI, workspace state and input controls
  pages/         dashboard, profile, simulator, inventory placeholder
  models/        explicit unit-bearing interfaces and runtime schemas
  calculations/  pure packaging cost engine
  optimization/  deterministic scenario comparison (no optimizer yet)
  inventory/     documented boundary for future planning functions
  demo/          editable OG TOFU fixture with source notes
  storage/       versioned, validated local persistence
  tests/         engine, storage and component regression tests
```

Read README.md for product context, PRODUCT_REQUIREMENTS.md for this task's scope, CALCULATIONS.md for formulas and AGENTS.md for coding rules. UI display formatting must not leak into numeric calculations. Change model interfaces and schemas together. Missing values must remain distinct from zero.

## Team workflow

After the foundation PR is merged, start from updated main:

```sh
git switch main
git pull --ff-only
git switch -c feat/short-task-name
# Make one focused change and run all checks above.
git add <changed-files>
git commit -m "Describe the concrete behavior change"
git push -u origin feat/short-task-name
```

Open a pull request against main with the problem, resulting behavior, source/assumption changes and actual check results. Ask a teammate to review numerical changes. Agree on ownership before editing shared model/calculation files in parallel. Keep commits focused and resolve conflicts on your feature branch; do not overwrite another teammate's changes or force-push main. Commit package-lock.json with dependency changes. Do not commit localStorage exports containing confidential pilot data, credentials, node_modules or dist.

## Troubleshooting

If npm cannot write its default cache in a restricted environment, run commands with `--cache /tmp/packpilot-npm-cache` (for example `npm ci --cache /tmp/packpilot-npm-cache`). If browser storage is blocked/full, the app reports that edits are session-only. Invalid mix totals are expected to show a calculation error until the shares total 100% again. Selecting a different labor method deliberately clears its rate rather than inventing a wage or reusing a rate with incompatible units.
