import { lazy, Suspense } from "react";
const CostChart = lazy(() => import("./CostChart"));
import { ZodError } from "zod";
import { calculatePackaging } from "../calculations/packaging";
import type {
  CalculationCatalog,
  PackagingCostResult,
  ProductionScenario,
} from "../models/types";
import { number, euro } from "./format";
export { number, euro } from "./format";
export function evaluate(
  scenario: ProductionScenario,
  catalog: CalculationCatalog,
) {
  try {
    return { result: calculatePackaging(scenario, catalog), error: null };
  } catch (error) {
    return {
      result: null,
      error:
        error instanceof ZodError
          ? "Check your inputs: numeric values must be finite, non-negative and no greater than 1 trillion."
          : error instanceof Error
            ? error.message
            : "Unable to calculate this scenario.",
    };
  }
}
export function Metrics({ result }: { result: PackagingCostResult }) {
  return (
    <div className="metrics">
      <div className="metric primary">
        <span>Monthly operating cost</span>
        <strong data-testid="operating-cost">
          {euro(result.operatingEuro)}
        </strong>
        <small>Materials + packaging labor</small>
      </div>
      <div className="metric">
        <span>Packaging cost per kg</span>
        <strong data-testid="cost-per-kg">
          {result.productionKg === 0
            ? "Not applicable"
            : euro(result.euroPerKg, 3)}
        </strong>
        <small>Per kg of planned production</small>
      </div>
      <div className="metric">
        <span>Packages required</span>
        <strong data-testid="total-packages">
          {number(result.totalPackages)}
        </strong>
        <small>Whole packages, rounded up</small>
      </div>
      <div className="metric">
        <span>Packaging labor</span>
        <strong>
          {number(result.laborHours, 2)}
          {result.laborHours !== null && <em> hrs</em>}
        </strong>
        <small>Worker-hours · estimated</small>
      </div>
    </div>
  );
}
export function Results({
  result,
  catalog,
}: {
  result: PackagingCostResult;
  catalog: CalculationCatalog;
}) {
  const chart = [
    { name: "Materials & labels", value: result.materialEuro ?? 0 },
    { name: "Packaging labor", value: result.laborEuro ?? 0 },
  ];
  return (
    <>
      {result.warnings.map((w) => (
        <div className="notice" role="status" key={w}>
          {w}
        </div>
      ))}
      <Metrics result={result} />
      <div className="result-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">COST STRUCTURE</span>
              <h2>Where packaging spend goes</h2>
            </div>
            <span className="chip">EUR / month</span>
          </div>
          {result.operatingEuro !== null && result.operatingEuro > 0 ? (
            <div className="cost-chart">
              <div
                className="chart"
                role="img"
                aria-label={`Material expenditure ${euro(result.materialEuro)}, labor expenditure ${euro(result.laborEuro)}`}
              >
                <Suspense
                  fallback={<span className="muted">Loading chart…</span>}
                >
                  <CostChart data={chart} />
                </Suspense>
              </div>
              <div className="legend">
                {chart.map((entry, i) => (
                  <div key={entry.name}>
                    <span className={`dot dot-${i}`} />
                    <span>{entry.name}</span>
                    <strong>
                      {euro(i ? result.laborEuro : result.materialEuro)}
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="empty">
              {result.operatingEuro === null
                ? "Complete the missing inputs to see the cost breakdown."
                : "No packaging costs at zero production."}
            </p>
          )}
          <p className="footnote">
            Operating costs exclude equipment, energy, maintenance, waste and
            overhead.
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
                  <th>Target kg</th>
                  <th>Packages</th>
                  <th>Material cost</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={`${row.productId}-${row.formatId}`}>
                    <th scope="row">
                      {catalog.formats.find((f) => f.id === row.formatId)?.name}
                      <small>
                        {
                          catalog.products.find((p) => p.id === row.productId)
                            ?.name
                        }
                      </small>
                    </th>
                    <td>{number(row.targetKg, 3)}</td>
                    <td>{number(row.packages)}</td>
                    <td>{euro(row.materialEuro)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th>Total</th>
                  <td>{number(result.productionKg, 3)}</td>
                  <td>{number(result.totalPackages)}</td>
                  <td>{euro(result.materialEuro)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="footnote">
            Rounded package capacity: {number(result.packagedCapacityKg, 3)} kg.
            Partial final packages may leave unused capacity.
          </p>
        </section>
      </div>
    </>
  );
}
