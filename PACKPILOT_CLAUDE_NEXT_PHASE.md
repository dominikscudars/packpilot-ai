# PackPilot AI — Guided Demo, Packaging Insights and Reliable Research

You are the lead product engineer working on PackPilot AI, a packaging decision-support application for small and medium food manufacturers, initially in Latvia and the EU.

Implement the work below against the latest repository. Do not stop at a proposal. Deliver working, tested changes in focused PRs, preserving the existing calculation engines, authentication, company isolation and useful tools.

Repository: https://github.com/dominikscudars/packpilot-ai

## 1. Establish the current state before editing

Read AGENTS.md, CLAUDE.md, COLLABORATION.md, README.md, PRODUCT_REQUIREMENTS.md, CALCULATIONS.md, FRONTEND_INTEGRATION.md and relevant backend instructions. Fetch origin, inspect current main, all open PRs and their changed files. Use your own branch/worktree and preserve other contributors' work.

The repository has moved quickly. This handoff reviewed main at `132b2d5` and the deployed PR #27 results-hub preview on 19 November 2026. Recheck newer commits before implementation. Codex PR #14 is closed and was superseded by Claude's account-access work in PR #18; do not restore the old Codex branch over main.

Review the actual current deployment in a fresh browser session. The deployment inspected for this handoff was:
https://packpilot-demo-git-claude-results-hub-dominikscudars.vercel.app/

Identify the current production URL from deployment metadata; do not assume this preview is the permanent production address.

Observed starting point, not a list of features to rebuild:

- Login/signup and a simulated plans/checkout flow already exist. Company accounts were not enabled on the inspected deployment.
- Open local demo leads to a mostly empty data-entry form with explicit OG TOFU example-fill actions.
- There are two main steps and separate Market research, Sales forecast, Stock & orders, Customer survey and Company profile tools.
- Results and research redirect an unconfigured demo to data entry, but the feature navigation remains visible and Sales forecast can be opened before completing setup.
- Data entry displays calculated results before the visitor saves, so the intended two-stage experience is not consistently enforced.
- Labels currently mix “Your results”, “Your costs”, “Change my data” and “Change in step 1”. Some helper text still references the removed standalone simulator workflow.
- Editing material prices and recalculating already works. In the reference example, changing only the 1 kg format's material cost from EUR 0.07 to EUR 0.08 increases monthly packaging cost from EUR 286 to EUR 294.
- Research already uses Gemini, a web-research tool and deterministic scenario evaluation. There are also separately labelled prepared OG TOFU answers. The live AI response quality was not benchmarked in this review.
- Sales forecasting already accepts pasted spreadsheets/CSV; surveys already offer question generation and response analysis; reorder planning already exists. Improve these rather than duplicate them.

First record a short audit of what is present, partial, broken or missing, with evidence and the commit inspected. Then implement the priorities below.

## 2. Required product journey: data first, insights second

The product owner explicitly confirmed this interpretation of “lock”: visitors must complete the data-entry step before seeing insights, and must remain free to edit their data afterward. This is an onboarding gate, not a paid-access gate or a browser trap.

Use this journey:

Open demo → Enter your data → View packaging insights → Edit data & costs → Update insights.

Use **Packaging Insights** as the consistent name for the results hub, including the page title, navigation, buttons and breadcrumbs. Use **Edit data & costs** for the main editing action.

For a newly started demo:

- Open a focused setup screen. Hide or clearly disable the feature sidebar and prevent access to results, research, forecasts, stock, surveys and company pages until setup is accepted.
- Keep Exit demo, help and explicitly labelled example-fill controls available. Do not disable browser navigation or create an inescapable experience.
- Explain the two steps in one sentence. Do not show full KPI cards, charts, research recommendations or results tables inside the initial data-entry page.
- Allow useful import assistance within setup itself, rather than making users leave the locked flow for a separate feature page.
- If valid saved demo data exists, show “Review your saved inputs” with those values and an explicit continuation action. Do not silently substitute OG TOFU for the visitor's data.

Implement the gate centrally, including direct URLs, browser back/forward, reload and legacy route aliases. Do not rely on a scenario name, company name, disabled navigation link or cosmetic flag as the readiness test. Model setup state explicitly and version persisted demo state. Validate stored inputs when restoring them.

Define minimum valid setup from the engine's real requirements: valid production amount, at least one valid pack size and valid production allocation totaling 100%, plus any structural references the engine requires. Zero production must have a deliberate supported empty state. Missing optional financial or equipment information must not force users to invent numbers. Allow partial insights where meaningful, with unavailable metrics labelled Unknown and the missing inputs identified.

Only transition after validation and successful save. Failed saves stay on the form with the draft preserved. Resetting the demo resets setup readiness. Scope all readiness and drafts to the correct mode, user and company; this UI gate must never replace backend authentication or membership checks.

## 3. Make data entry and cost editing straightforward

Retain the existing form and models where suitable. Group fields into:

1. Production: company/product context and monthly kg.
2. Pack formats: weight in grams, share by weight, material/label cost per pack.
3. Labour: either cost per pack OR hourly wages with the required throughput/staffing inputs.
4. Equipment: cycle time, packs per cycle, operators and available hours where known.
5. Optional operating costs: clearly separate fields for supported recurring costs and investment, without double counting.

Use explicit units and plain English. Support decimal commas where appropriate for Latvian users. Validate finite values, non-negative costs, positive weights, duplicate/broken references and allocation totals. Highlight the field requiring attention, not an unexplained engine error.

Keep OG TOFU fills optional and label reported values versus assumptions accurately. A user-entered value must not retain a misleading “verified” or “reported by OG TOFU” label.

Use **View packaging insights** on first completion and **Save changes & update insights** during editing. Make **Edit data & costs** prominent on the insights page and let users jump directly to the relevant cost section.

Preserve edits across accidental navigation where feasible, distinguish unsaved drafts from the saved baseline, and provide cancel/revert. Never overwrite a newer draft with a delayed save response. Changing data must invalidate or visibly mark outdated AI reports and comparisons; old results cannot masquerade as calculations on new inputs.

## 4. Build Packaging Insights around decisions

Use the current results hub as the foundation. Arrange it in this order:

- Concise input summary, source labels, last-saved state and Edit data & costs.
- Monthly packaging cost, cost per kg, package quantity and packing labour, with clear units and honest Unknown/N/A states.
- Material versus labour breakdown and per-format costs. Explain why small packs may cost more per kg.
- Two or three useful observations derived from actual calculations: largest cost driver, relevant capacity constraint, or the missing input preventing an investment comparison. Do not call these guaranteed savings.
- Relevant next actions: Research alternatives, Test a cost change, Plan stock, Review demand and Use customer feedback.
- Assumptions, exclusions, calculation explanation and detailed tables as progressive disclosure.

Retain existing planning tools and research. Connect them through this hub instead of adding more unrelated main navigation items. Give every feature a clear route back to Packaging Insights and Edit data & costs.

Offer a baseline-versus-proposed-change comparison through the existing engine. Keep proposed changes separate until explicitly applied. Distinguish lower unit cost from lower total spend when production changes. Show financial savings/payback only when the engine's comparability and completeness rules are satisfied. Never fill missing recurring costs with zero just to make a comparison work.

## 5. Improve the AI through grounding and evaluation

“Make the AI very good” means measurable improvements to its behavior, tools and evidence. Do not claim that changing a system prompt trains or fine-tunes a model. Do not upload customer information into a training dataset or start paid fine-tuning. Actual model training needs a separate approved dataset, privacy plan, evaluation and budget.

Build on the current server-side provider integration and tools:

- Give each request a structured snapshot of the current company inputs, units, provenance, calculation outputs, missing fields, relevant user goals and explicitly attached survey/forecast context.
- Ask a focused follow-up when a recommendation needs information the company has not provided. Do not assume every company is a tofu producer or hard-code OG TOFU conclusions.
- Use calculation tools for every company-specific numerical comparison. Preserve the engine's decimal precision, mass accounting and labour rules. Do not let the model invent costs, capacity, savings or ROI.
- Return structured recommendation data where practical: recommendation, reason, evidence, evaluated assumptions, measurable impact, uncertainties and next action. Render numeric impact from tool outputs rather than trusting numbers embedded in prose alone.
- Research external machinery, materials, supplier claims and regulations with traceable sources. Prefer official legislation/regulators and manufacturer technical documentation for their respective claims. Record source URL, title, publication/access date where available, region, currency, and whether prices include VAT, shipping or installation. Unknown values remain unknown.
- Distinguish a listed price from a supplier quote, supplier claims from independent evidence, and published requirements from a compliance determination. Do not guarantee food-contact safety, shelf life, recyclability or machine compatibility.
- Treat retrieved pages, supplier text, uploaded documents and survey answers as untrusted data, never as instructions. Validate tool arguments and sanitize rendered content/links.
- Keep prepared OG TOFU research visibly separate from live, company-specific answers. Do not present its costs as applying to another company's inputs. Show which snapshot and date support a report.
- Scope chat, survey attachments, caches and reports to the right workspace. On company/input changes, invalidate stale state and ignore late responses from the old snapshot. Never reuse one company's private context for another.
- Provide clear loading, cancellation, timeout, quota and retry behavior. Preserve the user's question on failure. Do not claim a fixed number of free questions unless a real enforced policy supports it.
- Review the public demo advisor's request/body limits, abuse protection and server-side quota controls separately from signed-in company access. UI gating is not API authorization or protection against AI spending. Keep keys server-side.

Add a versioned evaluation set of at least 20 representative cases: OG TOFU reference; a different food business; missing wages; zero production; invalid shares; smaller-pack economics; production growth; non-comparable demand; unknown equipment cost; non-positive payback; insufficient forecast history; contradictory survey evidence; no reliable supplier source; outdated regulatory information; unsafe shelf-life certainty; retrieved prompt injection; provider quota failure; stale input snapshots; company switching; and a normal useful recommendation.

Separate deterministic offline CI tests from optional live-provider evaluations. Record baseline and changed results on the same cases. Require exact agreement with calculator outputs for numeric fixtures; evaluate source support, uncertainty handling, relevance, actionability and latency for model answers. Report which checks are automated and which require human review. Do not claim live AI quality was validated using mocks alone.

## 6. Add only useful, connected improvements

After the core flow works, implement these two bounded additions if the audit confirms they are missing:

**A. Data completeness and action list.** Identify exactly which missing inputs prevent which decisions, with links to the relevant field. Prioritize the next useful measurement or quote. Avoid an arbitrary confidence percentage that implies scientific accuracy.

**B. Shareable decision brief.** Provide a print/PDF-friendly one-page summary and a simple export of inputs/results. Include the input snapshot, units, assumptions, exclusions, source dates and any evaluated comparison. Make it usable when talking to a supplier or colleague. Export only the active workspace's permitted data and protect spreadsheet exports against formula injection.

Also produce a ranked follow-up backlog, rather than implementing every idea immediately. Assess practical value, required data, effort and dependencies for:

- Supplier quote comparison including quantity tiers, MOQ, lead time, shipping, VAT treatment and quote date.
- Cost history and alerts when a material price or labour assumption changes materially.
- More reliable forecast import: explicit column mapping, duplicate/missing months, missing versus zero, outliers, preview before applying and visible uncertainty. Do not promise seasonality from insufficient data.
- Scenario sensitivity ranges and equipment break-even analysis using validated assumptions.
- Product contribution analysis only when selling price and all required non-packaging costs are supplied; never label packaging-only deductions as profit.
- Packaging specification/document checklist with evidence status, without presenting it as certification.

Do not add a second survey, forecast, inventory engine or research chatbot. Extend what exists. Do not invent customer demand for these candidates; identify them as hypotheses to validate with manufacturers.

## 7. Keep access and pricing separate

Preserve the current login/signup and company membership behavior. The data-entry gate must not require an account or payment to see basic demo insights. Demo data remains local and is never silently uploaded after signup.

Keep the paywall a clearly labelled simulation. No real checkout, card collection, subscription or entitlement. Pricing, paid tiers, billing intervals and commercial promises remain undecided. Do not choose prices or purchase services in this task.

## 8. Acceptance tests and delivery

Add meaningful tests proving:

- Fresh demo and all protected deep links lead to data entry; feature pages and full results cannot appear before setup completion.
- Inputs are validated, unknown financial values remain unknown, and incomplete/failed saves do not unlock insights.
- Successful setup opens Packaging Insights; all editing labels are consistent.
- Edit data & costs restores the correct draft; save recalculates results, while cancel retains the saved baseline. Refresh/back/forward and corrupt or blocked storage behave sensibly.
- User/company switches cannot share readiness, private records, survey context or AI reports. Late responses cannot overwrite newer inputs.
- Original reference remains exactly 800/300/200 packages, 1,300 total, EUR 91 materials + EUR 195 labour = EUR 286, EUR 0.286/kg.
- Changing only the 1 kg reference material price to EUR 0.08 produces EUR 294 total; reverting returns EUR 286.
- Existing auth, company isolation, calculation, forecasting, survey and stock tests continue to pass.
- AI tool constraints, failure handling, source rendering and snapshot isolation are covered; no unsupported “trained AI” claims.
- Checkout preview creates no payment or real access grant.
- Keyboard navigation, labels, focus, loading/empty/error states and mobile layouts work at 320/390 px and desktop widths.

Run the repository's required tests, TypeScript checks, formatting and builds, plus relevant backend, HTTP integration and staging checks. Verify browser flows and record screenshots. Keep offline checks runnable without live cloud keys.

Deliver in focused stages: (1) guided entry and editing loop; (2) insights and connected improvements; (3) AI grounding and evaluations. Update collaboration ownership and handoffs. For each PR, report what changed, checks actually run, remaining limitations and deployment requirements.

Finish with a short working-product walkthrough and the prioritized backlog. Do not merge or deploy under this prompt; provide reviewable PRs and preview evidence. If a separate current instruction explicitly authorizes a release, verify its exact scope before applying it.
