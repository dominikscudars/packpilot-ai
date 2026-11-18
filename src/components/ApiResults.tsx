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
          <span>Monthly operating cost</span>
          <strong data-testid="operating-cost">
            {money(result.totalPackagingOperatingEuro)}
          </strong>
          <small>Materials + packaging labor</small>
        </div>
        <div className="metric">
          <span>Packaging cost per kg</span>
          <strong data-testid="cost-per-kg">
            {result.monthlyProductionKg === "0"
              ? "Not applicable"
              : money(result.packagingEuroPerPlannedKg, 3)}
          </strong>
          <small>Per kg of planned production</small>
        </div>
        <div className="metric">
          <span>Whole packages</span>
          <strong data-testid="total-packages">
            {decimalText(result.totalPackages, 0)}
          </strong>
          <small>Mass-preserving allocation</small>
        </div>
        <div className="metric">
          <span>Packaging labor</span>
          <strong>
            {decimalText(result.personHours)} <em>hrs</em>
          </strong>
          <small>Person-hours · estimated</small>
        </div>
      </div>
      <div className="result-grid">
        <section className="panel">
          <span className="eyebrow">COST STRUCTURE</span>
          <h2>Where packaging spend goes</h2>
          <p>
            Materials and labels:{" "}
            <strong>{money(result.totalMaterialEuro)}</strong>
          </p>
          <p>
            Packaging labor: <strong>{money(result.totalLaborEuro)}</strong>
          </p>
          {result.totalMaterialEuro !== null &&
            result.totalLaborEuro !== null &&
            new Decimal(result.totalPackagingOperatingEuro ?? "0").gt(0) && (
              <div className="chart">
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
              </div>
            )}
          <p>
            Including recurring costs:{" "}
            <strong>{money(result.totalIncludingRecurringEuro)}</strong>
          </p>
          <p>Machine-hours: {decimalText(result.machineHours)}</p>
          <p className="footnote">
            Unknown costs stay unknown. Chart values are rounded for display
            only; calculations retain decimal precision.
          </p>
        </section>
        <section className="panel">
          <span className="eyebrow">PRODUCTION MIX</span>
          <h2>Packaging requirements</h2>
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
                    <th>
                      {input.formats.find((f) => f.id === r.formatId)
                        ?.portionWeightGrams.value ?? "?"}{" "}
                      g
                    </th>
                    <td>{decimalText(r.requestedKg, 6)}</td>
                    <td>{decimalText(r.packedKg, 6)}</td>
                    <td>{decimalText(r.packages, 0)}</td>
                    <td>{money(r.materialEuro)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
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
