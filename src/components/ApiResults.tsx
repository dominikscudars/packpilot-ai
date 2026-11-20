import type { ReactNode } from "react";
import { Icon } from "./Icon";
import { fieldLabel, friendlyNote } from "./guidance";
import { lazy, Suspense } from "react";
import { Decimal } from "decimal.js";
import type { PackagingCostResult, ScenarioInput } from "../models/api";
const CostChart = lazy(() => import("./CostChart"));
export function decimalText(value: string | number | null, digits = 2): string {
  if (value === null) return "Unknown";
  const [whole, fraction] = new Decimal(value).toFixed(digits).split(".");
  return (
    whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",") +
    (fraction ? `.${fraction}` : "")
  );
}
export const money = (value: string | null, digits = 2) =>
  value === null ? "Unknown" : `€${decimalText(value, digits)}`;
export function Notes({
  data,
  quiet = false,
}: {
  /** Hide setup guidance when the page lists missing inputs itself. */
  quiet?: boolean;
  data: {
    warnings: string[];
    assumptions: string[];
    missingInputs?: string[];
    exclusions?: string[];
  };
}) {
  const notes = data.warnings.map(friendlyNote);
  const steps = notes.filter((n) => !n.attention);
  const readable = (s: string) => {
    const [, key, rest] = /^(input\.[\w.]+): (.*)$/.exec(s) ?? [];
    return key ? `${fieldLabel(key)}: ${rest}` : s;
  };
  return (
    <>
      <div aria-live="polite">
        {notes
          .filter((n) => n.attention)
          .map((n, i) => (
            <p className="notice attention" key={i}>
              {n.text}
            </p>
          ))}
        {!quiet && steps.length > 0 && (
          <Guidance items={steps.map((n) => n.text)} />
        )}
      </div>
      <details className="panel result-notes">
        <summary>How we calculated this: assumptions and open inputs</summary>
        {[
          ...data.assumptions.map(readable),
          ...(data.missingInputs ?? []).map(
            (i) => `Still needed: ${fieldLabel(i)}`,
          ),
          ...(data.exclusions ?? []),
        ].map((s, i) => (
          <p key={i}>{s}</p>
        ))}
      </details>
    </>
  );
}
/** Calm "next step" card for incomplete inputs; not an error. */
export function Guidance({ items }: { items: string[] }) {
  return (
    <div className="notice guidance" role="status">
      <span className="guidance-label">Next step · setup guidance</span>
      {items.length === 1 ? (
        <p>{items[0]}</p>
      ) : (
        <ul>
          {items.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
export function ApiResults({
  result,
  input,
  afterMetrics,
  afterBreakdown,
}: {
  result: PackagingCostResult;
  input: ScenarioInput;
  /** Optional content shown right under the headline figures. */
  afterMetrics?: ReactNode;
  /** Optional content between the cost breakdown and the calculation notes. */
  afterBreakdown?: ReactNode;
}) {
  return (
    <>
      <div className="metrics">
        <div className="metric primary">
          <div className="metric-heading">
            <span>Monthly operating cost</span>
            <span className="metric-icon">
              <Icon name="wallet" />
            </span>
          </div>
          <strong data-testid="operating-cost">
            {money(result.totalPackagingOperatingEuro)}
          </strong>
          <small>Materials + packaging labor</small>
        </div>
        <div className="metric">
          <div className="metric-heading">
            <span>Packaging cost per kg</span>
            <span className="metric-icon">
              <Icon name="scale" />
            </span>
          </div>
          <strong data-testid="cost-per-kg">
            {result.monthlyProductionKg === "0"
              ? "Not applicable"
              : money(result.packagingEuroPerPlannedKg, 3)}
          </strong>
          <small>Per kg of planned production</small>
        </div>
        <div className="metric">
          <div className="metric-heading">
            <span>Whole packages</span>
            <span className="metric-icon">
              <Icon name="box" />
            </span>
          </div>
          <strong data-testid="total-packages">
            {decimalText(result.totalPackages, 0)}
          </strong>
          <small>Mass-preserving allocation</small>
        </div>
        <div className="metric">
          <div className="metric-heading">
            <span>Packaging labor</span>
            <span className="metric-icon">
              <Icon name="clock" />
            </span>
          </div>
          <strong>
            {decimalText(result.personHours)} <em>hrs</em>
          </strong>
          <small>Person-hours · estimated</small>
        </div>
      </div>
      {afterMetrics}
      <div className="result-grid">
        <section className="panel cost-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">COST STRUCTURE</span>
              <h2>Where packaging spend goes</h2>
            </div>
            <span className="section-icon">
              <Icon name="wallet" />
            </span>
          </div>
          <div className="cost-visual">
            {result.totalMaterialEuro !== null &&
            result.totalLaborEuro !== null &&
            new Decimal(result.totalPackagingOperatingEuro ?? "0").gt(0) ? (
              <div
                className="chart"
                role="img"
                aria-label={`Monthly cost breakdown: materials and labels ${money(result.totalMaterialEuro)}, packaging labor ${money(result.totalLaborEuro)}.`}
              >
                <Suspense fallback={<p>Loading chart…</p>}>
                  <CostChart
                    data={[
                      {
                        name: "Materials & labels",
                        value: Number(result.totalMaterialEuro),
                      },
                      {
                        name: "Packaging labor",
                        value: Number(result.totalLaborEuro),
                      },
                    ]}
                  />
                </Suspense>
                <div className="chart-center">
                  <small>MONTHLY TOTAL</small>
                  <strong>{money(result.totalPackagingOperatingEuro)}</strong>
                </div>
              </div>
            ) : (
              <div className="chart-empty">
                <Icon name="wallet" />
                <strong>{money(result.totalPackagingOperatingEuro)}</strong>
                <span>
                  {result.totalPackagingOperatingEuro === null
                    ? "Add missing cost inputs to see the breakdown."
                    : "No packaging spend at this volume."}
                </span>
              </div>
            )}
            <div className="cost-legend">
              <div>
                <span className="legend-dot material" />
                <span>Materials and labels</span>
                <strong>{money(result.totalMaterialEuro)}</strong>
              </div>
              <div>
                <span className="legend-dot labor" />
                <span>Packaging labor</span>
                <strong>{money(result.totalLaborEuro)}</strong>
              </div>
            </div>
          </div>
          <div className="cost-detail">
            <span>Including recurring costs</span>
            <strong>{money(result.totalIncludingRecurringEuro)}</strong>
          </div>
          <div className="cost-detail">
            <span>Machine-hours</span>
            <strong>
              {decimalText(result.machineHours)} <small>hrs</small>
            </strong>
          </div>
          <p className="footnote">
            Unknown costs stay unknown. Chart values are rounded for display
            only; calculations retain decimal precision.
          </p>
        </section>
        <section className="panel mix-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">PRODUCTION MIX</span>
              <h2>Packaging requirements</h2>
            </div>
            <span className="section-icon">
              <Icon name="box" />
            </span>
          </div>
          <div className="mix-heading">
            <span>Planned production</span>
            <strong>
              {decimalText(result.monthlyProductionKg, 6).replace(/\.?0+$/, "")}{" "}
              <small>kg / month</small>
            </strong>
          </div>
          <div className="mix-bar" aria-hidden="true">
            {input.formats.map((format, index) => (
              <span
                key={format.id}
                style={{
                  width: `${format.allocationPercent.value ?? "0"}%`,
                  background: ["#4f61f6", "#6ed7b2", "#efb86a", "#b896e5"][
                    index % 4
                  ],
                }}
              />
            ))}
          </div>
          <div
            className="mix-legend"
            aria-label="Requested mix by production weight"
          >
            {input.formats.map((format, index) => (
              <span key={format.id}>
                <i
                  style={{
                    background: ["#4f61f6", "#6ed7b2", "#efb86a", "#b896e5"][
                      index % 4
                    ],
                  }}
                />
                {format.portionWeightGrams.value ?? "?"} g{" "}
                <strong>{format.allocationPercent.value ?? "?"}%</strong>
              </span>
            ))}
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Format</th>
                  <th>Requested kg</th>
                  <th>Packed kg</th>
                  <th>Packages</th>
                  <th>€ per packed kg</th>
                  <th>Materials</th>
                  <th>Labor</th>
                  <th>Packaging cost</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((r) => (
                  <tr key={r.formatId}>
                    <th scope="row">
                      {input.formats.find((f) => f.id === r.formatId)
                        ?.portionWeightGrams.value ?? "?"}{" "}
                      g
                    </th>
                    <td>
                      {new Decimal(r.requestedKg).toDecimalPlaces(6).toString()}
                    </td>
                    <td>
                      {new Decimal(r.packedKg).toDecimalPlaces(6).toString()}
                    </td>
                    <td>{decimalText(r.packages, 0)}</td>
                    <td>
                      {r.packages === 0
                        ? "n/a"
                        : money(r.packagingEuroPerPackedKg, 3)}
                    </td>
                    <td>{money(r.materialEuro)}</td>
                    <td>{money(r.laborEuro)}</td>
                    <td>{money(r.packagingOperatingEuro)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mass-summary">
            Packed: {decimalText(result.packedProductionKg, 6)} kg · Unpackaged:{" "}
            <strong>{decimalText(result.unpackagedProductionKg, 6)} kg</strong>
          </p>
          <p className="footnote">
            Euro per packed kg compares formats: smaller portions need more
            packages, labels and handling time for each kilogram. Whole packages
            never invent extra production. The engine may adjust the mix to fill
            available mass; infeasible residuals remain unpackaged. Machine time
            uses continuous throughput, excluding setup and downtime.
          </p>
        </section>
      </div>
      {afterBreakdown}
      <Notes data={result} />
    </>
  );
}
