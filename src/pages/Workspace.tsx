import { Link, useLocation } from "react-router-dom";
import { useWorkspace } from "../components/WorkspaceProvider";
import { EXAMPLE_PROFILE } from "../demo/apiDemo";
import { useRequest, RequestState } from "../components/AsyncState";
import { money, decimalText, Notes } from "../components/ApiResults";
import { BarList, SegmentedBar } from "../components/charts";
import { completeness, observations } from "../insights/insights";
import { TestChange } from "../components/TestChange";
import { Forecasting, Optimise } from "../components/Forecasting";
import { Sensitivity } from "../components/Sensitivity";
import { optimisations } from "../forecast/optimise";
import { useEffect, useMemo, type ReactNode } from "react";
import { sizeLabel } from "../onboarding/FormSections";
import type { PackagingCostResult, ScenarioInput } from "../models/api";

const n = (v: string | null) => (v === null ? null : Number(v));
const euro = (v: number | null, digits = 2) =>
  v === null ? "Unknown" : money(String(v), digits);

type Tab = "overview" | "costs" | "forecast" | "savings";
const TABS: { id: Tab; to: string; label: string }[] = [
  { id: "overview", to: "/", label: "Overview" },
  { id: "costs", to: "/costs", label: "Costs" },
  { id: "forecast", to: "/forecast", label: "Forecast" },
  { id: "savings", to: "/savings", label: "Savings" },
];

/** Shared header and tabs for the workspace pages. */
function WorkspaceShell({ tab, children }: { tab: Tab; children: ReactNode }) {
  const { onboarding, company, baseline } = useWorkspace();
  const empty = onboarding !== "completed";
  return (
    <div className="page workspace">
      <header className="page-head">
        <div>
          <span className="eyebrow">{company.name}</span>
          <h1>Your workspace</h1>
          {baseline.name === EXAMPLE_PROFILE && (
            <p className="badge example-badge" data-testid="example-profile">
              Example data: OG TOFU · machine hours and maintenance estimated
            </p>
          )}
          {empty && (
            <p>
              Enter your production and cost data to see your costs and
              forecasts.
            </p>
          )}
        </div>
        <div className="head-actions">
          <Link to={empty ? "/welcome" : "/data"} className="button secondary">
            {empty ? "Enter your data" : "Edit data & costs"}
          </Link>
          <Link to="/research" className="button">
            Ask market research
          </Link>
        </div>
      </header>
      <nav className="subnav" aria-label="Workspace sections">
        {TABS.map((t) => (
          <Link
            key={t.id}
            to={t.to}
            className={t.id === tab ? "active" : undefined}
            aria-current={t.id === tab ? "page" : undefined}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {empty && tab === "overview" && (
        <section className="empty-hero" aria-label="Enter your data">
          <div>
            <h2>Your workspace is ready for your numbers</h2>
            <p>
              Enter your production and cost data to see your costs and
              forecasts.
            </p>
          </div>
          <Link to="/welcome" className="button primary-large">
            Enter your data
          </Link>
        </section>
      )}
      {children}
    </div>
  );
}

const EMPTY: Record<Tab, { title: string; text: string }> = {
  overview: {
    title: "No costs yet",
    text: "Enter your monthly production, pack sizes, packaging prices and labour to see your monthly packaging cost, cost per kilogram and what drives it.",
  },
  costs: {
    title: "No costs yet",
    text: "Enter your monthly production, pack sizes, packaging prices and labour to see your monthly packaging cost, cost per kilogram and what drives it.",
  },
  forecast: {
    title: "No forecast yet",
    text: "Once your data is saved, see how cost, volume and machine capacity change if production grows or prices move.",
  },
  savings: {
    title: "No savings ideas yet",
    text: "Once your data is saved, PackPilot calculates which changes would save the most.",
  },
};

/** Shows the empty state until the company's data exists. */
function WithData({ tab, children }: { tab: Tab; children: ReactNode }) {
  const { onboarding } = useWorkspace();
  if (onboarding === "completed") return <>{children}</>;
  return (
    <section className="card section" aria-label={EMPTY[tab].title}>
      <EmptyState {...EMPTY[tab]} />
    </section>
  );
}

/** Overview: the saving, the key numbers and a summary of each tab. */
export function Workspace() {
  const { baseline } = useWorkspace();
  return (
    <WorkspaceShell tab="overview">
      <WithData tab="overview">
        <Headline input={baseline.input} />
        <Overview input={baseline.input} />
      </WithData>
    </WorkspaceShell>
  );
}

/** Costs: breakdown, pack sizes, drivers and sensitivity. */
export function WorkspaceCosts() {
  const { baseline, onboarding } = useWorkspace();
  return (
    <WorkspaceShell tab="costs">
      <WithData tab="costs">
        <section className="card section" aria-labelledby="your-costs">
          <div className="section-head">
            <h2 id="your-costs">Your costs</h2>
            {onboarding === "completed" && (
              <Link to="/data#costs" className="text-link">
                Edit costs
              </Link>
            )}
          </div>
          <CostsSection input={baseline.input} />
        </section>
      </WithData>
    </WorkspaceShell>
  );
}

/** Forecast: what happens if production or prices change. */
export function WorkspaceForecast() {
  const { baseline } = useWorkspace();
  return (
    <WorkspaceShell tab="forecast">
      <WithData tab="forecast">
        <section className="card section" aria-labelledby="forecasting">
          <div className="section-head">
            <h2 id="forecasting">Future forecasting</h2>
          </div>
          <Forecasting input={baseline.input} />
        </section>
      </WithData>
    </WorkspaceShell>
  );
}

/** Savings: ways to optimise today's costs and the comparison tool. */
export function WorkspaceSavings() {
  const { baseline } = useWorkspace();
  const { hash } = useLocation();
  useEffect(() => {
    if (hash)
      document
        .getElementById(hash.slice(1))
        ?.scrollIntoView?.({ block: "start" });
  }, [hash]);
  return (
    <WorkspaceShell tab="savings">
      <WithData tab="savings">
        <section className="card section" aria-labelledby="optimise-title">
          <Optimise end={baseline.input} label="Now" />
        </section>
        <div id="test-change">
          <TestChange />
        </div>
      </WithData>
    </WorkspaceShell>
  );
}

/** One engine run, shown as the KPI row plus a summary card per tab. */
function Overview({ input }: { input: ScenarioInput }) {
  const { gateway } = useWorkspace();
  const state = useRequest(JSON.stringify(input), () =>
    gateway.calculate(input),
  );
  const options = useMemo(() => {
    try {
      return optimisations(input)
        .options.filter((o) => (o.savingEuro ?? 0) > 0.004)
        .sort((a, b) => (b.savingEuro ?? 0) - (a.savingEuro ?? 0))
        .slice(0, 3);
    } catch {
      return [];
    }
  }, [input]);
  if (!state.data)
    return (
      <RequestState
        error={state.error}
        onRetry={state.retry}
        guidance={state.guidance}
        loading={!state.error}
      />
    );
  const r = state.data;
  const notes = observations(r, input);
  return (
    <>
      <section className="card section" aria-label="Key numbers">
        <Kpis result={r} />
      </section>
      <div className="overview-grid">
        <Link to="/costs" className="overview-card">
          <span className="overview-label">Costs</span>
          <strong>What drives your cost</strong>
          <p>
            {notes[0]?.text ?? "See your cost breakdown by type and pack size."}
          </p>
          <span className="overview-more">See cost breakdown →</span>
        </Link>
        <Link to="/forecast" className="overview-card">
          <span className="overview-label">Forecast</span>
          <strong>What if production grows?</strong>
          <p>
            See how cost, cost per kg and machine time change if production or
            prices move.
          </p>
          <span className="overview-more">Open forecast →</span>
        </Link>
        <Link to="/savings" className="overview-card">
          <span className="overview-label">Savings</span>
          <strong>Top ways to save</strong>
          {options.length ? (
            <ul>
              {options.map((o) => (
                <li key={o.id}>
                  {o.title}: <b>{euro(o.savingEuro)}</b> a month
                </li>
              ))}
            </ul>
          ) : (
            <p>Ideas to cut cost per kg and machine time.</p>
          )}
          <span className="overview-more">See all ways to save →</span>
        </Link>
      </div>
    </>
  );
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-state" role="note">
      <span className="empty-icon" aria-hidden="true">
        ∅
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      <Link to="/welcome" className="button secondary">
        Enter your data
      </Link>
    </div>
  );
}

function CostsSection({ input }: { input: ScenarioInput }) {
  const { gateway } = useWorkspace();
  const state = useRequest(JSON.stringify(input), () =>
    gateway.calculate(input),
  );
  if (!state.data)
    return (
      <RequestState
        error={state.error}
        onRetry={state.retry}
        guidance={state.guidance}
        loading={!state.error}
      />
    );
  return <Costs result={state.data} input={input} />;
}

function Costs({
  result: r,
  input,
}: {
  result: PackagingCostResult;
  input: ScenarioInput;
}) {
  const material = n(r.totalMaterialEuro);
  const labour = n(r.totalLaborEuro);
  const recurring = n(r.recurringOperatingEuroPerMonth);
  const notes = observations(r, input);
  const missing = completeness(input);
  return (
    <div className="costs">
      <Kpis result={r} />

      <div className="costs-grid">
        <div>
          <h3 className="mini-title">What makes up your monthly cost</h3>
          {material !== null || labour !== null ? (
            <SegmentedBar
              label="Monthly cost by type"
              format={(v) => euro(v)}
              parts={[
                { name: "Packaging materials", value: material ?? 0 },
                { name: "Packing labour", value: labour ?? 0 },
                { name: "Other recurring", value: recurring ?? 0 },
              ]}
            />
          ) : (
            <p className="muted">
              Add material and labour costs to see the breakdown.
            </p>
          )}
          {notes.length > 0 && (
            <ul
              className="drivers"
              aria-label="Biggest cost drivers"
              data-testid="cost-drivers"
            >
              {notes.map((o) => (
                <li key={o.id}>{o.text}</li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="mini-title">Packaging cost per kg, by pack size</h3>
          <BarList
            label="Packaging cost per kg by pack size"
            format={(v) => euro(v, 3)}
            rows={r.rows.map((row) => {
              const format = input.formats.find((f) => f.id === row.formatId);
              const op = n(row.packagingOperatingEuro);
              return {
                name:
                  sizeLabel(format?.portionWeightGrams.value ?? null) ??
                  row.formatId,
                value: n(row.packagingEuroPerPackedKg),
                note: `${decimalText(row.packages, 0)} packs${
                  op !== null && Number(row.packages) > 0
                    ? ` · ${euro(op / Number(row.packages), 3)} each`
                    : ""
                }`,
              };
            })}
          />
        </div>
      </div>

      <details className="cost-table">
        <summary>Cost by pack size (table)</summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Pack size</th>
                <th scope="col">Share</th>
                <th scope="col">Packs / month</th>
                <th scope="col">€ per kg</th>
                <th scope="col">Materials</th>
                <th scope="col">Labour</th>
                <th scope="col">Monthly cost</th>
              </tr>
            </thead>
            <tbody>
              {r.rows.map((row) => {
                const format = input.formats.find((f) => f.id === row.formatId);
                return (
                  <tr key={row.formatId}>
                    <th scope="row">
                      {sizeLabel(format?.portionWeightGrams.value ?? null) ??
                        row.formatId}
                    </th>
                    <td>{format?.allocationPercent.value ?? "?"}%</td>
                    <td>{decimalText(row.packages, 0)}</td>
                    <td>{money(row.packagingEuroPerPackedKg, 3)}</td>
                    <td>{money(row.materialEuro)}</td>
                    <td>{money(row.laborEuro)}</td>
                    <td>{money(row.packagingOperatingEuro)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>

      {missing.length > 0 && (
        <div className="missing-strip" role="note" aria-label="What is missing">
          <strong>Add for complete numbers:</strong>
          <ul>
            {missing.map((m) => (
              <li key={m.needs}>
                <Link to={`/data#${m.field}`}>{m.needs}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Notes data={r} quiet />
      <details className="collapsible-inner">
        <summary>What moves your cost most</summary>
        <Sensitivity input={input} result={r} />
      </details>
    </div>
  );
}

/** The single biggest saving PackPilot can calculate from the saved data. */
function Headline({ input }: { input: ScenarioInput }) {
  const best = useMemo(() => {
    const { options, base } = optimisations(input);
    const top = options
      .filter((o) => (o.savingEuro ?? 0) > 0.004)
      .sort((a, b) => (b.savingEuro ?? 0) - (a.savingEuro ?? 0))[0];
    return top ? { top, base } : null;
  }, [input]);
  if (!best) return null;
  const { top, base } = best;
  const share =
    base.cost && base.cost > 0
      ? Math.round(((top.savingEuro ?? 0) / base.cost) * 100)
      : null;
  return (
    <section
      className="headline"
      aria-label="What this means"
      data-testid="headline"
    >
      <div>
        <span className="headline-label">What this means</span>
        <p className="headline-value">
          You could save <strong>{euro(top.savingEuro)}</strong> a month
          {share !== null && share > 0 && <span> ({share}%)</span>}
        </p>
        <p className="headline-how">
          {top.title}
          {top.euroPerKg.from !== null &&
            top.euroPerKg.to !== null &&
            ` · ${euro(top.euroPerKg.from, 3)} → ${euro(top.euroPerKg.to, 3)} per kg`}
        </p>
      </div>
      <Link to="/savings" className="button secondary">
        See all ways to save
      </Link>
    </section>
  );
}

/** The four headline numbers, shared by Overview and Costs. */
function Kpis({ result: r }: { result: PackagingCostResult }) {
  const recurring = n(r.recurringOperatingEuroPerMonth);
  const usage = r.machineUsage.find((m) => m.utilizationPercent !== null);
  return (
    <div className="kpis">
      <div className="kpi kpi-hero">
        <span className="kpi-label">Packaging cost per month</span>
        <strong data-testid="operating-cost">
          {money(r.totalPackagingOperatingEuro)}
        </strong>
        <span className="kpi-sub">
          materials + labour
          {recurring !== null && recurring > 0
            ? ` · ${euro(recurring)} other recurring`
            : ""}
        </span>
      </div>
      <div className="kpi">
        <span className="kpi-label">Cost per kg</span>
        <strong data-testid="cost-per-kg">
          {money(r.packagingEuroPerPlannedKg, 3)}
        </strong>
        <span className="kpi-sub">
          of {decimalText(r.monthlyProductionKg, 0)} kg produced
        </span>
      </div>
      <div className="kpi">
        <span className="kpi-label">Packs per month</span>
        <strong data-testid="total-packages">
          {decimalText(r.totalPackages, 0)}
        </strong>
        <span className="kpi-sub">bags and labels used</span>
      </div>
      <div className="kpi">
        <span className="kpi-label">Machine time</span>
        <strong data-testid="machine-hours">
          {r.machineHours === null
            ? "Unknown"
            : `${decimalText(r.machineHours, 1)} h`}
        </strong>
        <span className="kpi-sub">
          {usage?.utilizationPercent
            ? `${Math.round(Number(usage.utilizationPercent))}% of available hours`
            : "per month"}
        </span>
      </div>
    </div>
  );
}
