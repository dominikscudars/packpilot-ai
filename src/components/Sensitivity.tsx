import { Link } from "react-router-dom";
import type { PackagingCostResult, ScenarioInput } from "../models/api";
import { useWorkspace } from "./WorkspaceProvider";
import { useRequest, RequestState } from "./AsyncState";
import { money } from "./ApiResults";
import { SERIES } from "./charts";
import {
  DRIVERS,
  STEP,
  breakEven,
  vary,
  type Driver,
} from "../insights/sensitivity";

/** ±10% on each key driver and the payback threshold of the recorded machine. */
export function Sensitivity({
  input,
  result,
}: {
  input: ScenarioInput;
  result: PackagingCostResult;
}) {
  return (
    <section
      className="panel sensitivity"
      aria-label="Sensitivity and break-even"
    >
      <h2>Sensitivity and break-even</h2>
      <p className="muted">
        What moves your cost per kg most, each input ±{STEP * 100}%.
      </p>
      {result.packagingEuroPerPlannedKg === null ? (
        <p className="notice" data-testid="sensitivity-missing">
          Add the missing material and labour costs above to calculate
          sensitivity.
        </p>
      ) : (
        <Drivers input={input} />
      )}
      <BreakEvenView result={result} />
    </section>
  );
}

function Drivers({ input }: { input: ScenarioInput }) {
  const { gateway } = useWorkspace();
  const state = useRequest(`sensitivity:${JSON.stringify(input)}`, () =>
    Promise.all(
      DRIVERS.map(async (d) => {
        const low = vary(input, d.id, 1 - STEP);
        const high = vary(input, d.id, 1 + STEP);
        if (!low || !high) return { driver: d, low: null, high: null };
        // Production changes total spend, so only unit costs are compared.
        const same = d.id !== "volume";
        const [a, b] = await Promise.all([
          gateway.compare(input, low, same),
          gateway.compare(input, high, same),
        ]);
        return {
          driver: d,
          low: a.differences.euroPerPlannedKg.absolute,
          high: b.differences.euroPerPlannedKg.absolute,
        };
      }),
    ),
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
  // Inputs with no effect on cost per kg (e.g. volume when every cost is
  // per pack) are left out rather than shown as ±€0.000.
  const known = state.data.filter(
    (r): r is { driver: Driver; low: string; high: string } =>
      r.low !== null &&
      r.high !== null &&
      Math.max(Math.abs(Number(r.low)), Math.abs(Number(r.high))) >= 0.0005,
  );
  const unknown = state.data.filter((r) => r.low === null || r.high === null);
  const size = (r: { low: string; high: string }) =>
    Math.max(Math.abs(Number(r.low)), Math.abs(Number(r.high)));
  known.sort((a, b) => size(b) - size(a));
  const max = Math.max(...known.map(size), 0);
  const width = (v: string) =>
    max > 0 ? `${(Math.abs(Number(v)) / max) * 100}%` : "0%";
  const signed = (v: string) =>
    `${Number(v) > 0 ? "+" : Number(v) < 0 ? "−" : "±"}${money(
      String(Math.abs(Number(v))),
      3,
    )}`;
  return (
    <>
      {known.length > 0 && (
        <figure className="tornado" aria-label="Change in cost per kg for ±10%">
          <ul>
            {known.map((r) => (
              <li key={r.driver.id} data-testid={`sensitivity-${r.driver.id}`}>
                <span className="tornado-name">{r.driver.name}</span>
                <span className="tornado-bars" aria-hidden="true">
                  <span className="tornado-half left">
                    <span
                      style={{ width: width(r.low), background: SERIES[0] }}
                    />
                  </span>
                  <span className="tornado-half">
                    <span
                      style={{ width: width(r.high), background: SERIES[1] }}
                    />
                  </span>
                </span>
                <span className="tornado-values">
                  −10%: <strong>{signed(r.low)}</strong> · +10%:{" "}
                  <strong>{signed(r.high)}</strong> per kg
                </span>
              </li>
            ))}
          </ul>
        </figure>
      )}
      {unknown.map((r) => (
        <p key={r.driver.id} className="notice">
          Add <Link to={`/data#${r.driver.field}`}>{r.driver.needs}</Link> to
          calculate its sensitivity.
        </p>
      ))}
    </>
  );
}

function BreakEvenView({ result }: { result: PackagingCostResult }) {
  const b = breakEven(result);
  // Shown only once it can be calculated; missing inputs are listed in
  // Your costs already.
  if (b.status === "missing") return null;
  return (
    <div className="break-even" data-testid="break-even">
      <h3 className="mini-title">Machine payback</h3>
      <p>
        Monthly saving needed to pay back the{" "}
        <strong>{money(b.investmentEuro)}</strong> machine:
      </p>
      <table>
        <thead>
          <tr>
            <th scope="col">Pay back within</th>
            <th scope="col">Net saving per month</th>
            <th scope="col">Per kg produced</th>
          </tr>
        </thead>
        <tbody>
          {b.rows.map((row) => (
            <tr key={row.months}>
              <th scope="row">{row.months} months</th>
              <td>{money(row.monthlySavingEuro)}</td>
              <td>
                {row.savingEuroPerKg === null
                  ? "Unknown"
                  : money(row.savingEuroPerKg, 3)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
