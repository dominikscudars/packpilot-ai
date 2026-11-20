import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { ScenarioInput } from "../models/api";
import { useWorkspace } from "./WorkspaceProvider";
import { LineChart, SERIES } from "./charts";
import { loadHistory } from "../forecast/historyStore";
import {
  NO_CHANGE,
  capacityLimit,
  fromHistory,
  project,
  type Assumptions,
  type Point,
} from "../forecast/projection";

const eur = (v: number) =>
  `€${v.toLocaleString("en-US", {
    minimumFractionDigits: v < 1 && v > 0 ? 3 : 0,
    maximumFractionDigits: v < 1 ? 3 : v < 10 ? 2 : 0,
  })}`;
const kg = (v: number) => `${Math.round(v).toLocaleString("en-US")} kg`;
const hours = (v: number) =>
  `${v.toLocaleString("en-US", { maximumFractionDigits: 1 })} h`;
const pct = (v: number) => `${v > 0 ? "+" : ""}${v}%`;

/**
 * Future forecasting from the saved data. With sales history it shows the
 * actual months and a straight-line trend; otherwise a projection that only
 * follows the user's stated assumptions. Neither is presented as a reliable
 * prediction.
 */
export function Forecasting({ input }: { input: ScenarioInput }) {
  const { scope } = useWorkspace();
  const history = useMemo(() => {
    const saved = loadHistory(scope);
    return saved ? fromHistory(input, saved) : null;
  }, [scope, input]);
  const [mode, setMode] = useState<"history" | "projection">(
    history ? "history" : "projection",
  );
  const [a, setA] = useState<Assumptions>(NO_CHANGE);
  const projection = useMemo(() => project(input, a), [input, a]);
  const active = mode === "history" && history ? history.points : projection;
  const projectedFrom = active.findIndex((p) => p.kind === "projected");
  const limit = capacityLimit(input, active);
  const now = active.find((p) => p.offset === 0) ?? projection[0];
  const end = active.at(-1)!;

  const field = (key: keyof Assumptions, label: string, hint: string) => (
    <label className="assumption">
      <span>{label}</span>
      <span className="input-suffix">
        <input
          type="number"
          aria-label={label}
          aria-description={`Percent, ${hint}`}
          inputMode="decimal"
          step={5}
          min={-90}
          max={500}
          value={a[key]}
          onChange={(e) => {
            const v = Number(e.target.value);
            setA({
              ...a,
              [key]: Number.isFinite(v) ? Math.max(-90, Math.min(500, v)) : 0,
            });
          }}
        />
        <span aria-hidden="true">%</span>
      </span>
      <small>{hint}</small>
    </label>
  );

  return (
    <div className="forecasting">
      <div
        className="segmented-control"
        role="group"
        aria-label="Forecast source"
      >
        <button
          type="button"
          aria-pressed={mode === "history"}
          disabled={!history}
          onClick={() => setMode("history")}
        >
          From your sales history
        </button>
        <button
          type="button"
          aria-pressed={mode === "projection"}
          onClick={() => setMode("projection")}
        >
          Projection from assumptions
        </button>
      </div>

      {mode === "projection" || !history ? (
        <>
          {!history && (
            <p className="muted small">
              No sales history yet, so this is a projection from your current
              data and the assumptions below — not a prediction.{" "}
              <Link to="/forecast">Add your sales history</Link> to see your
              actual trend.
            </p>
          )}
          <div className="assumptions" aria-label="Projection assumptions">
            {field(
              "productionChangePct",
              "Production change",
              `by ${a.months} months from now`,
            )}
            {field(
              "materialChangePct",
              "Material price change",
              "bags and labels",
            )}
            {field(
              "labourChangePct",
              "Labour cost change",
              "per pack or per hour",
            )}
            <label className="assumption">
              <span>Horizon</span>
              <select
                value={a.months}
                onChange={(e) => setA({ ...a, months: Number(e.target.value) })}
              >
                <option value={6}>6 months</option>
                <option value={12}>12 months</option>
                <option value={24}>24 months</option>
              </select>
              <small>changes ramp in evenly</small>
            </label>
          </div>
        </>
      ) : (
        <p className="muted small" data-testid="history-basis">
          Actual production for your last {history.months} months, then a
          straight-line trend ({history.trendKgPerMonth >= 0 ? "+" : ""}
          {history.trendKgPerMonth.toLocaleString("en-US")} kg per month) for
          the next 6 months at today's prices and pack mix. A trend estimate,
          not a guarantee. <Link to="/forecast">Update sales history</Link>
        </p>
      )}

      <p className="forecast-summary" data-testid="projection-summary">
        <Summary
          now={now}
          end={end}
          assumptions={mode === "projection" || !history ? a : null}
        />
      </p>

      <div className="chart-grid">
        <LineChart
          title="Packaging cost per month"
          labels={active.map((p) => p.label)}
          values={active.map((p) => p.costEuro)}
          projectedFrom={projectedFrom < 0 ? active.length : projectedFrom}
          format={eur}
          color={SERIES[0]}
        />
        <LineChart
          title="Production per month"
          labels={active.map((p) => p.label)}
          values={active.map((p) => p.productionKg)}
          projectedFrom={projectedFrom < 0 ? active.length : projectedFrom}
          format={kg}
          color={SERIES[1]}
        />
        <LineChart
          title="Machine-hours needed per month"
          labels={active.map((p) => p.label)}
          values={active.map((p) => p.machineHours)}
          projectedFrom={projectedFrom < 0 ? active.length : projectedFrom}
          format={hours}
          color={SERIES[2]}
          reference={
            limit.available !== null
              ? {
                  value: limit.available,
                  label: `Available: ${hours(limit.available)}`,
                }
              : undefined
          }
        />
      </div>
      <p className="chart-key" aria-hidden="true">
        <span className="key-solid" /> actual / current{" "}
        <span className="key-dashed" /> projected
      </p>

      <div className="capacity-note" role="note" data-testid="capacity-note">
        {limit.available === null ? (
          <>
            Add the hours your machine is available per month in{" "}
            <Link to="/data#equipment">Edit data &amp; costs</Link> to see when
            you would run out of capacity.
          </>
        ) : limit.first ? (
          <>
            <strong>Capacity limit:</strong> from {limit.first.label} packing
            needs {hours(limit.first.machineHours ?? 0)} a month, more than your{" "}
            {hours(limit.available)} available. You would need more hours, a
            faster machine or a second shift.
          </>
        ) : (
          <>
            <strong>Capacity:</strong> your available {hours(limit.available)} a
            month cover this whole period
            {end.machineHours !== null &&
              ` (up to ${hours(end.machineHours)} needed)`}
            .
          </>
        )}
      </div>
    </div>
  );
}

function Summary({
  now,
  end,
  assumptions,
}: {
  now: Point;
  end: Point;
  assumptions: Assumptions | null;
}) {
  const unchanged =
    assumptions &&
    !assumptions.productionChangePct &&
    !assumptions.materialChangePct &&
    !assumptions.labourChangePct;
  if (unchanged)
    return (
      <>
        No change assumed: your cost stays at{" "}
        <strong>{now.costEuro === null ? "Unknown" : eur(now.costEuro)}</strong>{" "}
        a month. Set a production or price change above to see its effect.
      </>
    );
  return (
    <>
      In {end.label}
      {assumptions &&
        ` (production ${pct(assumptions.productionChangePct)}, materials ${pct(
          assumptions.materialChangePct,
        )}, labour ${pct(assumptions.labourChangePct)})`}
      : packaging cost{" "}
      <strong>
        {end.costEuro === null ? "Unknown" : `${eur(end.costEuro)} a month`}
      </strong>
      {now.costEuro !== null &&
        end.costEuro !== null &&
        ` (now ${eur(now.costEuro)})`}
      , {end.euroPerKg === null ? "" : `${eur(end.euroPerKg)} per kg, `}
      {end.productionKg === null ? "" : `${kg(end.productionKg)} produced`}.
    </>
  );
}
