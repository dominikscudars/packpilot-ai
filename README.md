# PackPilot AI
### Intelligent Packaging Optimization for Food Manufacturers

**PackPilot AI** is an AI-assisted packaging optimization and operations platform designed for small and medium-sized food manufacturing businesses.

Our mission is to help food manufacturers reduce packaging costs, improve production efficiency, evaluate packaging alternatives, and make better operational decisions through accessible, data-driven tools.

**Project:** Introduction to Entrepreneurship — Stockholm School of Economics in Riga (SSE Riga)  
**MVP deadline:** November 24, 2026  
**Development:** Codex + GitHub  
**Initial pilot company:** OG TOFU, Latvia

---

## 1. The Problem

Packaging is an essential part of food manufacturing, but choosing and managing the right packaging solutions can be complicated, time-consuming, and expensive.

Small and medium-sized manufacturers may face several challenges:

- High packaging material costs.
- Labor-intensive packaging processes.
- Inefficient packaging machinery.
- Difficulty comparing packaging suppliers and materials.
- Uncertainty about optimal packaging sizes.
- Difficulty planning packaging inventory and purchases.
- Limited resources for evaluating investments in new equipment.
- Difficulty understanding how packaging costs change as production scales.

Many smaller businesses do not have dedicated packaging engineers or optimization specialists.

They may rely on manual calculations, spreadsheets, supplier recommendations, or their own experience when making decisions.

These challenges create a potential opportunity for an accessible, AI-assisted decision-support platform.

### Validation status

We are currently conducting primary research with Latvian food manufacturers.

Initial responses from OG TOFU, Lapsu Mājas siers, and Siera ražotne indicate different packaging-related challenges, including manual packaging inefficiency, supplier quality problems, and packaging inventory planning.

These findings are preliminary. The product's final feature priorities and business model will be refined as additional research becomes available.

---

## 2. Our Solution

PackPilot AI combines a structured data-collection process, a mathematical optimization engine, and AI-assisted recommendations.

The platform helps manufacturers:

1. Understand their current packaging costs and efficiency.
2. Identify inefficient packaging processes.
3. Compare alternative packaging configurations.
4. Evaluate the financial impact of production growth.
5. Plan packaging material requirements.
6. Make informed packaging and machinery investment decisions.

### Long-term vision

PackPilot AI should evolve beyond a one-time packaging analysis tool into an ongoing packaging intelligence platform.

Potential future capabilities include:

- Continuous packaging cost monitoring.
- Inventory and purchasing optimization.
- Packaging supplier comparisons.
- Production and packaging demand forecasting.
- Machinery investment analysis.
- AI-assisted packaging recommendations.
- Automated reporting.
- Integration with manufacturers' existing systems.

These features are hypotheses to validate, not commitments for the initial MVP.

---

## 3. Target Customers

Our target market is **small and medium-sized food manufacturing businesses**.

Initial focus:

- Fresh food manufacturers.
- Dairy and cheese producers.
- Plant-based food manufacturers.
- Meat and fish processors.
- Producers using vacuum or other protective packaging.
- Manufacturers with multiple product and packaging formats.

We are particularly interested in companies that have outgrown simple manual processes but lack sophisticated packaging management software.

The platform should eventually accommodate different production volumes, packaging materials, machinery configurations, and levels of operational complexity.

---

## 4. Initial Pilot — OG TOFU

Our first real-world case is OG TOFU, a Latvian manufacturer of fresh tofu.

We have information about its packaging processes, current machinery, costs, and production volumes.

### Available pilot data

| Parameter | Value |
|---|---|
| Company | OG TOFU |
| Product | Fresh tofu |
| Monthly production | Approximately 1,000 kg |
| Packaging formats | 250 g, 500 g, 1 kg |
| Current packaging machine | HURAKAN VAC 400 |
| Reported packaging cycle | Approximately 2 packages per 70 seconds |
| Estimated throughput | Approximately 103 packages/hour |
| Packaging and label cost | Approximately €0.06–0.08 per package |
| Packaging labor cost | Approximately €0.15 per package |
| Current packaging material | PA/PE vacuum bags |
| Storage | Refrigerated |
| Current shelf life | Approximately 10 days |

Some inputs are estimates or company-reported values, and not all packaging formats are necessarily in active commercial use.

### Initial demonstration scenario

For software testing, use a hypothetical monthly production mix by weight:

- 80% in 1 kg packages.
- 15% in 500 g packages.
- 5% in 250 g packages.

At 1,000 kg production, this gives:

| Packaging format | Packages |
|---|---:|
| 1 kg | 800 |
| 500 g | 300 |
| 250 g | 200 |
| **Total** | **1,300** |

Assuming €0.07 for materials and labeling, plus €0.15 in labor per package:

- Monthly material cost: €91.
- Monthly labor cost: €195.
- Total packaging operating cost: €286.
- Packaging cost per kilogram: €0.286.

These figures provide a reference test for the initial calculation engine.

The packaging mix is hypothetical and must not be presented as verified sales data.

---

## 5. MVP Functional Requirements

### Feature 1 — Company Onboarding

Allow manufacturers to create and edit a company profile.

Required capabilities:

- Company information.
- Products and product categories.
- Monthly production volumes.
- Multiple packaging formats.
- Packaging materials and dimensions.
- Packaging material costs.
- Labor costs.
- Packaging machinery and throughput.
- Packaging inventory levels.
- Suppliers and basic purchasing information.

The system must support incomplete information and distinguish between reported values, assumptions, and missing data.

### Feature 2 — Packaging Cost Analysis

Calculate:

- Material cost per package.
- Labor cost per package.
- Total packaging cost.
- Packaging cost per kilogram.
- Total monthly packaging expenditure.
- Packaging labor hours.
- Packaging machine utilization, where capacity data is available.

Calculations must be performed using deterministic formulas.

AI must not invent numerical results.

### Feature 3 — Interactive Optimization Simulator

Allow users to modify:

- Monthly production volume.
- Packaging format mix.
- Material prices.
- Labor costs.
- Packaging throughput.
- Machinery investment costs.

The application must recalculate results immediately.

Users should be able to compare the current operation against alternative scenarios.

### Feature 4 — Packaging Inventory Planning

Allow users to enter:

- Current packaging inventory.
- Expected production volume.
- Packaging consumption per product.
- Supplier lead times.
- Minimum order quantities.
- Safety stock assumptions.

Calculate:

- Expected packaging consumption.
- Forecast packaging requirements.
- Estimated remaining stock coverage.
- Suggested reorder points.
- Suggested purchase quantities.

The first version may use simple deterministic planning formulas rather than machine learning.

### Feature 5 — Dashboard

Present results through a clear interactive interface.

The dashboard should display:

- Production overview.
- Packaging cost breakdown.
- Cost per kilogram.
- Packaging labor requirements.
- Current scenario versus alternative scenario.
- Inventory status.
- Areas requiring attention.

All figures must be connected to actual user inputs and calculations.

---

## 6. Future AI Functionality

The long-term product will include a conversational AI packaging consultant.

Potential capabilities:

- Guide users through onboarding.
- Ask for missing information.
- Explain financial calculations.
- Identify optimization opportunities.
- Compare alternatives.
- Help users understand recommendations.
- Support scenario exploration.

The AI layer must rely on the platform's calculation engine and verified inputs.

It must clearly distinguish facts, estimates, and recommendations.

AI-generated recommendations must not automatically certify food-contact compliance, material suitability, shelf life, or machinery compatibility.

---

## 7. Technical Architecture

### Initial technology stack

- React
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Recharts
- Vitest
- GitHub
- Codex
- Vercel

### Data storage

Initially use browser-based storage for demonstration purposes.

The architecture should allow migration to a database, such as Supabase, when persistent multi-user functionality becomes necessary.

### Architectural principles

**Modularity**

Separate the user interface, data models, calculation engine, inventory planning, and recommendation logic.

**Calculation accuracy**

Financial outputs must be reproducible and supported by tests.

**Data transparency**

Clearly label verified/reported information, assumptions, and missing values.

**Scalability**

Support multiple companies, products, packaging formats, suppliers, and machines.

**Collaboration**

Use GitHub feature branches and pull requests to allow multiple developers to work simultaneously.

**Security**

Do not expose API keys or credentials in frontend code. Do not commit confidential manufacturer information to the repository.

---

## 8. MVP Success Criteria

By November 24, 2026, we aim to demonstrate a functional application that can:

1. Load and edit an OG TOFU company profile.
2. Calculate current packaging costs accurately.
3. Display results through a functional dashboard.
4. Simulate changes in production volumes and packaging configurations.
5. Compare baseline and alternative scenarios.
6. Estimate packaging inventory requirements.
7. Save entered information between sessions.
8. Clearly distinguish assumptions from verified company data.

A working product with reliable calculations is more important than implementing every planned feature.

---

## 9. Business Model

The business model is still under validation.

Possible revenue models:

**Subscription:** Ongoing access to packaging cost monitoring, inventory planning, and optimization tools.

**Pay-per-analysis:** One-time fees for detailed packaging optimization or machinery investment analysis.

**Hybrid:** Subscription-based monitoring with additional fees for advanced optimization projects.

Our ongoing manufacturer interviews and survey results will help determine which model is most appropriate.

We should not assume that recurring subscriptions are justified until we demonstrate recurring customer value.

---

## 10. Primary Research

We are collecting evidence from two sources:

**Consumer research**

An OG TOFU consumer survey investigating packaging-size preferences, consumption patterns, and purchasing behavior.

**Manufacturer research**

A survey and interviews with Latvian food manufacturers investigating:

- Packaging problems.
- Problem frequency.
- Financial and operational impact.
- Existing solutions.
- Available data.
- Recurring packaging management activities.
- Potential product requirements.

The results will guide development priorities.

Research findings should be documented separately from assumptions and proposed features.

---

## 11. Development Roadmap

### Phase 1 — Foundation
- Project initialization.
- Shared data models.
- Application navigation.
- OG TOFU demonstration dataset.

### Phase 2 — Core Optimization
- Packaging cost calculations.
- Production efficiency calculations.
- Interactive scenario simulator.
- Dashboard.

### Phase 3 — Recurring Operations
- Packaging inventory planning.
- Inventory and purchasing recommendations.

### Phase 4 — Validation and Testing
- Automated calculation tests.
- User testing.
- Improvements based on manufacturer feedback.
- Deployment.

### Future Development
- AI consultant.
- Supplier database.
- Automated external research.
- Historical cost monitoring.
- Advanced forecasting.
- ERP integrations.

---

## 12. Project Goal

Our immediate objective is to demonstrate that PackPilot AI can transform real packaging and production data into useful, actionable business insights.

The MVP is a proof of concept, not a complete commercial product.

Our long-term objective is to develop an accessible packaging intelligence platform that helps small and medium-sized food manufacturers make better packaging decisions and continuously improve their operations.


## Development setup

See [DEVELOPMENT.md](DEVELOPMENT.md) for installation, running the app and collaboration. Read [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md) for the implemented foundation scope and [CALCULATIONS.md](CALCULATIONS.md) for formulas, assumptions and rounding.

## Backend foundation (local demo)

The independent Node.js/TypeScript API is in [`backend/`](backend/README.md). It provides SQLite persistence, packaging calculations, scenario comparison and inventory planning. The React frontend now connects to the authenticated API and offers a separate explicit local demo. See [Frontend integration](FRONTEND_INTEGRATION.md).

```sh
cd backend
cp .env.example .env
npm ci
npm run db:generate
npm run db:migrate
npm run db:seed
npm run auth:setup
npm run members:bootstrap -- og-tofu 11111111-1111-4111-8111-111111111111
npm run dev
```

See [backend/README.md](backend/README.md) for contracts, examples, rounding, tests and the authenticated API contract. [Authentication setup](backend/AUTHENTICATION.md) covers Supabase, signed local development tokens, company memberships and the remaining deployment requirements. Frontend sign-in, company records, saved scenarios and inventory calculations are connected; see [frontend setup](FRONTEND_INTEGRATION.md).
