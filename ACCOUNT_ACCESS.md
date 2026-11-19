# Account access and paywall preview

Owner: Codex. Status: implementation in progress.

Requested scope: modern login and sign-up pages using the existing Supabase session integration, plus an explicitly simulated paywall/checkout with pricing undecided and no payment processing.

Base: main at bc3f4e2bd3112a3eea84d085f0977ace2d8f8f05. Work branch: codex/auth-signup-paywall.

Owned areas: src/components/AuthGate.tsx, src/auth/session.ts, new account-access page components and scoped stylesheet, dedicated auth/access tests and frontend setup documentation. Minimal collaboration status updates only. Avoid src/App.tsx, src/styles.css, src/tests/App.test.tsx and all research/advisor implementation files owned by Claude.

Acceptance: login/session behavior and company isolation preserved; sign-up supports email confirmation and immediate-session configurations; invalid input and provider failures are visible; simulated checkout collects no payment details, sets no real entitlement and quotes no price; offline demo remains available; calculation reference tests preserved; focused draft PR with actual validation results. No merge or production deployment in this task.
