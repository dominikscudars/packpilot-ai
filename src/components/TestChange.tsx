import { useState } from "react";
import type { ScenarioInput } from "../models/api";
import type { compareScenarios } from "../../backend/src/calculation-engine/comparison";
import { assumed } from "../../backend/src/domain/inputs";
import { useWorkspace } from "./WorkspaceProvider";
import { message } from "./AsyncState";
import { money, decimalText } from "./ApiResults";
import { normalizeDecimal } from "./QuantityField";

type Comparison = ReturnType<typeof compareScenarios>;
type Kind = "material" | "labour" | "production" | "machine";

const note = "Proposed change for comparison; not independently verified.";
const q = (v: string) => assumed(normalizeDecimal(v), note);
const valid = (v: string) => /^\d+(\.\d+)?$/.test(normalizeDecimal(v));
const sizeLabel = (grams: number) =>
  grams >= 1000 && grams % 1000 === 0 ? `${grams / 1000} kg` : `${grams} g`;

/** Builds the proposed scenario; the saved baseline is never modified. */
function propose(
  base: ScenarioInput,
  kind: Kind,
  values: Record<string, string>,
): ScenarioInput | string {
  const next = structuredClone(base);
  const need = (key: string, label: string) => {
    const v = values[key] ?? "";
    if (!valid(v)) throw new Error(`Enter ${label} as a number, 0 or more.`);
    return q(v);
  };
  try {
    if (kind === "material") {
      const i = Number(values.format ?? 0);
      const format = next.formats.at(i);
      if (!format) return "Choose a pack size.";
      format.materialCost = {
        method: "combined",
        combinedEuroPerPackage: need("value", "the bag and label cost"),
      };
    } else if (kind === "labour") {
      next.labor =
        next.labor.method === "hourly"
          ? {
              method: "hourly",
              euroPerPersonHour: need("value", "the hourly wage"),
            }
          : {
              method: "perPackage",
              euroPerPackage: need("value", "the labour cost"),
            };
    } else if (kind === "production") {
      next.monthlyProductionKg = need("value", "monthly production");
    } else {
      const machine = next.machines.at(0);
      if (!machine) return "Add packing equipment in Edit data & costs first.";
      const t = machine.throughput;
      if (values.cycle || values.packs) {
        if (t.method !== "cycle")
          return "Enter cycle times in Edit data & costs first.";
        machine.throughput = {
          method: "cycle",
          cycleSeconds: values.cycle
            ? need("cycle", "seconds per cycle")
            : t.cycleSeconds,
          packagesPerCycle: values.packs
            ? need("packs", "packs per cycle")
            : t.packagesPerCycle,
        };
      }
      if (values.investment)
        machine.investmentEuro = need("investment", "the purchase price");
      if (values.maintenance)
        machine.maintenanceEuroPerMonth = need("maintenance", "maintenance");
      if (
        !values.cycle &&
        !values.packs &&
        !values.investment &&
        !values.maintenance
      )
        return "Enter at least one machine value to change.";
    }
  } catch (e) {
    return message(e);
  }
  return next;
}

/** Baseline versus one proposed change, using the engine's comparison rules. */
export function TestChange() {
  const { baseline, gateway, saveScenario, setBaseline, setLastComparison } =
    useWorkspace();
  const [kind, setKind] = useState<Kind>("material");
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{
    key: string;
    data: Comparison;
    proposed: ScenarioInput;
  } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState("");
  const baseKey = JSON.stringify(baseline.input);
  // A comparison made on earlier inputs is never shown as current.
  const current = result && result.key === baseKey ? result : null;
  const set = (k: string, v: string) => {
    setValues({ ...values, [k]: v });
    setApplied("");
  };

  const field = (key: string, label: string, placeholder = "") => (
    <label>
      {label}
      <input
        inputMode="decimal"
        value={values[key] ?? ""}
        placeholder={placeholder}
        onChange={(e) => set(key, e.target.value)}
      />
    </label>
  );

  async function compare() {
    setError("");
    setApplied("");
    const proposed = propose(baseline.input, kind, values);
    if (typeof proposed === "string") return setError(proposed);
    const sameDemand =
      kind !== "production" &&
      JSON.stringify(proposed.formats.map((f) => f.allocationPercent)) ===
        JSON.stringify(baseline.input.formats.map((f) => f.allocationPercent));
    setBusy(true);
    try {
      const data = await gateway.compare(baseline.input, proposed, sameDemand);
      setResult({ key: baseKey, data, proposed });
      setLastComparison({ key: baseKey, kind, data });
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  const row = (
    label: string,
    a: string | null,
    b: string | null,
    digits = 2,
  ) => (
    <tr>
      <th scope="row">{label}</th>
      <td>{money(a, digits)}</td>
      <td>{money(b, digits)}</td>
    </tr>
  );

  return (
    <section className="panel test-change" aria-label="Test a cost change">
      <h2>Test a cost change</h2>
      <p className="muted">
        Try one change without touching your saved data. PackPilot compares it
        with your current operation; nothing changes until you apply it.
      </p>
      <div className="form-grid">
        <label>
          What do you want to change?
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as Kind);
              setValues({});
              setError("");
            }}
          >
            <option value="material">
              Bag and label cost of one pack size
            </option>
            <option value="labour">Labour cost</option>
            <option value="production">Monthly production</option>
            <option value="machine">
              Packing machine (speed, price, maintenance)
            </option>
          </select>
        </label>
        {kind === "material" && (
          <>
            <label>
              Pack size
              <select
                value={values.format ?? "0"}
                onChange={(e) => set("format", e.target.value)}
              >
                {baseline.input.formats.map((f, i) => (
                  <option key={f.id} value={i}>
                    {sizeLabel(Number(f.portionWeightGrams.value))}
                  </option>
                ))}
              </select>
            </label>
            {field("value", "New bag and label cost (€ per pack)", "e.g. 0.08")}
          </>
        )}
        {kind === "labour" &&
          field(
            "value",
            baseline.input.labor.method === "hourly"
              ? "New hourly wage (€ per hour)"
              : "New labour cost (€ per pack)",
          )}
        {kind === "production" && field("value", "New monthly production (kg)")}
        {kind === "machine" && (
          <>
            {field("cycle", "Seconds per cycle")}
            {field("packs", "Packs per cycle")}
            {field("investment", "Purchase price (€, one-off)")}
            {field("maintenance", "Maintenance (€ per month)")}
          </>
        )}
      </div>
      <button type="button" disabled={busy} onClick={() => void compare()}>
        {busy ? "Comparing…" : "Compare with my current costs"}
      </button>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {current && (
        <div className="comparison" data-testid="comparison">
          <table>
            <thead>
              <tr>
                <th />
                <th scope="col">Now</th>
                <th scope="col">With the change</th>
              </tr>
            </thead>
            <tbody>
              {row(
                "Packaging cost per month",
                current.data.baseline.totalPackagingOperatingEuro,
                current.data.alternative.totalPackagingOperatingEuro,
              )}
              {row(
                "Cost per kg",
                current.data.baseline.packagingEuroPerPlannedKg,
                current.data.alternative.packagingEuroPerPlannedKg,
                3,
              )}
              <tr>
                <th scope="row">Machine-hours per month</th>
                <td>{decimalText(current.data.baseline.machineHours, 1)}</td>
                <td>{decimalText(current.data.alternative.machineHours, 1)}</td>
              </tr>
            </tbody>
          </table>
          {kind === "production" ? (
            <p>
              Production changes, so total spend is not a saving or a loss:
              compare the <strong>cost per kg</strong>.
            </p>
          ) : current.data.comparableForSavings &&
            current.data.monthlyNetSavingsEuro !== null ? (
            <p data-testid="savings">
              Net change in monthly running costs:{" "}
              <strong>{money(current.data.monthlyNetSavingsEuro)}</strong> saved
              per month (negative means it costs more).
              {current.data.simplePaybackMonths !== null &&
                ` Simple payback: about ${decimalText(current.data.simplePaybackMonths, 1)} months.`}
            </p>
          ) : (
            <p className="notice" data-testid="no-savings">
              Savings and payback are not shown: they need monthly maintenance
              and other recurring costs (0 if none) in Edit data &amp; costs,
              and the same production for both options.
            </p>
          )}
          <button
            type="button"
            className="secondary"
            onClick={async () => {
              try {
                const saved = await saveScenario(
                  { ...baseline, input: current.proposed },
                  baseline.id === null,
                );
                setBaseline(saved);
                setApplied("Change applied to your saved data.");
              } catch (e) {
                setError(message(e));
              }
            }}
          >
            Apply this change to my data
          </button>
        </div>
      )}
      {applied && <p role="status">{applied}</p>}
    </section>
  );
}
