import { Link } from "react-router-dom";
import { useWorkspace } from "../components/WorkspaceProvider";
import { useRequest, RequestState } from "../components/AsyncState";
import { money, decimalText, Notes } from "../components/ApiResults";
import { BarList, SegmentedBar } from "../components/charts";
import { completeness, observations } from "../insights/insights";
import { TestChange } from "../components/TestChange";
import { DataSummary } from "../components/DataSummary";
import { Forecasting } from "../components/Forecasting";
import { sizeLabel } from "../onboarding/FormSections";
import type { PackagingCostResult, ScenarioInput } from "../models/api";

const n = (v: string | null) => (v === null ? null : Number(v));
const euro = (v: number | null, digits = 2) =>
  v === null ? "Unknown" : money(String(v), digits);

/** Workspace: Your costs and Future forecasting, from the saved data only. */
export function Workspace() {
  const { onboarding, company, baseline, savedAt } = useWorkspace();
  const empty = onboarding !== "completed";
  return (
    <div className="page workspace">
      <header className="page-head">
        <div>
          <span className="eyebrow">{company.name}</span>
          <h1>Your workspace</h1>
          <p>
            {empty
              ? "Enter your production and cost data to see your costs and forecasts."
              : `Calculated from your saved data${
                  savedAt
                    ? `, last saved ${new Date(savedAt).toLocaleString(
                        "en-GB",
                        {
                          dateStyle: "medium",
                          timeStyle: "short",
                        },
                      )}`
                    : ""
                }.`}
          </p>
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

      {empty && (
        <section className="empty-hero" aria-label="Enter your data">
          <div>
            <h2>Your workspace is ready for your numbers</h2>
            <p>
              You skipped data entry, so there are no costs or forecasts yet.
              PackPilot never fills the gaps with sample figures: everything
              here is calculated from what you enter.
            </p>
          </div>
          <Link to="/welcome" className="button primary-large">
            Enter your data
          </Link>
        </section>
      )}

      <div className="primary-sections">
        <section className="card section" aria-labelledby="your-costs">
          <div className="section-head">
            <h2 id="your-costs">Your costs</h2>
            {!empty && (
              <Link to="/data#costs" className="text-link">
                Edit costs
              </Link>
            )}
          </div>
          {empty ? (
            <EmptyState
              title="No costs yet"
              text="Enter your monthly production, pack sizes, packaging prices and labour to see your monthly packaging cost, cost per kilogram and what drives it."
            />
          ) : (
            <CostsSection input={baseline.input} />
          )}
        </section>

        <section className="card section" aria-labelledby="forecasting">
          <div className="section-head">
            <h2 id="forecasting">Future forecasting</h2>
          </div>
          {empty ? (
            <EmptyState
              title="No forecast yet"
              text="Once your data is saved, see how cost, volume and machine capacity change if production grows or prices move — and add your sales history for a trend."
            />
          ) : (
            <Forecasting input={baseline.input} />
          )}
        </section>
      </div>

      {!empty && (
        <>
          <div id="test-change" className="secondary-section">
            <TestChange />
          </div>
          <DataSummary input={baseline.input} savedAt={savedAt} />
        </>
      )}
    </div>
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
  const usage = r.machineUsage.find((m) => m.utilizationPercent !== null);
  const notes = observations(r, input);
  const missing = completeness(input);
  return (
    <div className="costs">
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
          <strong>To complete your picture:</strong>
          <ul>
            {missing.map((m) => (
              <li key={m.needs}>
                <Link to={`/data#${m.field}`}>{m.needs}</Link>
                <span className="muted">
                  {" "}
                  — needed for {m.decision.toLowerCase()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Notes data={r} quiet />
    </div>
  );
}
