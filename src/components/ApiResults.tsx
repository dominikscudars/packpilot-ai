import { Icon } from "./Icon";
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
}: {
  data: {
    warnings: string[];
    assumptions: string[];
    missingInputs?: string[];
    exclusions?: string[];
  };
}) {
  return (
    <>
      <div aria-live="polite">
        {data.warnings.map((w, i) => (
          <p className="notice" key={i}>
            {w}
          </p>
        ))}
      </div>
      <details className="panel result-notes">
        <summary>Assumptions, missing inputs and exclusions</summary>
        {[
          ...data.assumptions,
          ...(data.missingInputs ?? []).map((i) => `Missing: ${i}`),
          ...(data.exclusions ?? []),
        ].map((s, i) => (
          <p key={i}>{s}</p>
        ))}
      </details>
    </>
  );
}
export function ApiResults({
  result,
  input,
}: {
  result: PackagingCostResult;
  input: ScenarioInput;
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
                  <th>Materials</th>
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
                    <td>{money(r.materialEuro)}</td>
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
            Whole packages never invent extra production. The engine may adjust
            the mix to fill available mass; infeasible residuals remain
            unpackaged. Machine time uses continuous throughput, excluding setup
            and downtime.
          </p>
        </section>
      </div>
      <Notes data={result} />
    </>
  );
}
