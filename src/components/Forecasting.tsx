import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { ScenarioInput } from "../models/api";
import { LineChart, SERIES } from "./charts";
import { optimisations } from "../forecast/optimise";
import {
  NO_CHANGE,
  capacityLimit,
  project,
  scenarioAtEnd,
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
 * Future forecasting from the saved data: a projection that follows the
 * user's stated assumptions, with ways to optimise the projected period.
 */
export function Forecasting({ input }: { input: ScenarioInput }) {
  const [a, setA] = useState<Assumptions>(NO_CHANGE);
  const projection = useMemo(() => project(input, a), [input, a]);
  const active = projection;
  const projectedFrom = active.findIndex((p) => p.kind === "projected");
  const limit = capacityLimit(input, active);
  const now = active.find((p) => p.offset === 0) ?? projection[0];
  const end = active.at(-1)!;
  const endInput = useMemo(() => scenarioAtEnd(input, a), [input, a]);

  // What the user is typing, per field, so a box can be cleared and
  // retyped freely; the projection updates whenever the text is a number.
  const [typing, setTyping] = useState<
    Partial<Record<keyof Assumptions, string>>
  >({});
  const clamp = (v: number) => Math.max(-90, Math.min(500, v));
  const setValue = (key: keyof Assumptions, v: number) => {
    setA({ ...a, [key]: clamp(v) });
    setTyping({ ...typing, [key]: undefined });
  };
  const field = (
    key: keyof Assumptions,
    label: string,
    hint: string,
    presets: number[],
  ) => (
    <div className="assumption">
      <label htmlFor={`assume-${key}`}>{label}</label>
      <span className="input-suffix">
        <input
          id={`assume-${key}`}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          aria-label={label}
          aria-description={hint ? `Percent, ${hint}` : "Percent"}
          value={typing[key] ?? String(a[key])}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            const raw = e.target.value;
            setTyping({ ...typing, [key]: raw });
            const text = raw.trim().replace(",", ".").replace(/^\+/, "");
            if (text === "" || text === "-") setA({ ...a, [key]: 0 });
            else if (/^-?\d+(\.\d+)?$/.test(text))
              setA({ ...a, [key]: clamp(Number(text)) });
          }}
          onBlur={() => setTyping({ ...typing, [key]: undefined })}
        />
        <span aria-hidden="true">%</span>
      </span>
      <div className="presets" role="group" aria-label={`${label} presets`}>
        {presets.map((v) => (
          <button
            key={v}
            type="button"
            className="preset"
            aria-pressed={a[key] === v}
            onClick={() => setValue(key, v)}
          >
            {v > 0 ? `+${v}` : v === 0 ? "0" : `−${-v}`}%
          </button>
        ))}
      </div>
      {hint && <small>{hint}</small>}
    </div>
  );

  return (
    <div className="forecasting">
      <div className="assumptions" aria-label="Projection assumptions">
        {field(
          "productionChangePct",
          "Production change",
          `in ${a.months} months`,
          [0, 25, 50, 100],
        )}
        {field("materialChangePct", "Material price change", "", [-10, 0, 10])}
        {field("labourChangePct", "Labour cost change", "", [-10, 0, 10])}
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
        </label>
      </div>

      <p className="forecast-summary" data-testid="projection-summary">
        <Summary now={now} end={end} assumptions={a} />
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
          title="Machine time per month"
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

      {limit.available !== null && (
        <div className="capacity-note" role="note" data-testid="capacity-note">
          {limit.first ? (
            <>
              <strong>Capacity limit from {limit.first.label}:</strong>{" "}
              {hours(limit.first.machineHours ?? 0)} needed,{" "}
              {hours(limit.available)} available.
            </>
          ) : (
            <>
              <strong>Capacity is enough:</strong> up to{" "}
              {hours(end.machineHours ?? 0)} needed of {hours(limit.available)}{" "}
              available.
            </>
          )}
        </div>
      )}

      <Optimise
        end={endInput}
        label={
          !a.productionChangePct && !a.materialChangePct && !a.labourChangePct
            ? "Now"
            : end.label
        }
      />
    </div>
  );
}

const money = (v: number, digits = 2) =>
  `€${v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;

/** Concrete ways to optimise the projected period, each recalculated by the engine. */
export function Optimise({
  end,
  label,
}: {
  end: ScenarioInput;
  label: string;
}) {
  const { options } = useMemo(() => optimisations(end), [end]);
  if (!options.length) return null;

  return (
    <section
      className="optimise"
      aria-labelledby="optimise-title"
      data-testid="optimise"
    >
      <div className="optimise-head">
        <h3 id="optimise-title">
          Ways to optimise {label === "Now" ? "your costs" : `by ${label}`}
        </h3>
      </div>
      <ol className="optimise-list">
        {options.map((o, i) => {
          const freed =
            o.machineHours.from !== null &&
            o.machineHours.to !== null &&
            o.machineHours.from - o.machineHours.to > 0.05
              ? o.machineHours.from - o.machineHours.to
              : null;
          return (
            <li
              key={o.id}
              className="optimise-card"
              data-testid={`option-${o.id}`}
            >
              <div className="optimise-badges">
                {o.solvesCapacity && (
                  <span className="badge badge-ok">Solves capacity</span>
                )}
                {i === options.findIndex((x) => (x.savingEuro ?? 0) > 0) && (
                  <span className="badge badge-accent">Biggest saving</span>
                )}
              </div>
              <h4>{o.title}</h4>
              <div className="optimise-effect">
                {o.savingEuro !== null && o.savingEuro > 0.004 && (
                  <span className="effect-main">
                    −{money(o.savingEuro)} <small>a month</small>
                  </span>
                )}
                {o.euroPerKg.from !== null &&
                  o.euroPerKg.to !== null &&
                  o.euroPerKg.to < o.euroPerKg.from - 0.0004 && (
                    <span>
                      {money(o.euroPerKg.from, 3)} → {money(o.euroPerKg.to, 3)}{" "}
                      per kg
                    </span>
                  )}
                {freed !== null && <span>−{hours(freed)} machine time</span>}
                {o.id === "capacity" && o.machineHours.from !== null && (
                  <span>{hours(o.machineHours.from)} needed</span>
                )}
              </div>
              <p className="optimise-why">{o.why}</p>
              <div className="optimise-actions">
                {o.testable && (
                  <Link to="/savings#test-change" className="text-link">
                    Try it in Test a cost change
                  </Link>
                )}
                <Link
                  to={`/research?q=${encodeURIComponent(o.research)}`}
                  className="text-link"
                >
                  Research this →
                </Link>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
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
        No change set:{" "}
        <strong>{now.costEuro === null ? "Unknown" : eur(now.costEuro)}</strong>{" "}
        a month.
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
