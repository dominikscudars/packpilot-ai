import { Link } from "react-router-dom";
import type { Quantity, ScenarioInput } from "../models/api";
import { decimalText } from "./ApiResults";

const show = (q: Quantity, unit = "", digits = 0) =>
  q.value === null ? "not entered" : `${decimalText(q.value, digits)}${unit}`;

const grams = (q: Quantity) => {
  const g = Number(q.value);
  if (q.value === null || !Number.isFinite(g)) return "not entered";
  return g >= 1000 && g % 1000 === 0 ? `${g / 1000} kg` : `${g} g`;
};

/** Counts input values by source: reported, the user's entries, not entered. */
export function sourceCounts(input: ScenarioInput) {
  const counts = { reported: 0, entered: 0, missing: 0 };
  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    if ("quality" in record && "value" in record) {
      if (record.quality === "missing") counts.missing++;
      else if (record.quality === "reported" || record.quality === "verified")
        counts.reported++;
      else counts.entered++;
      return;
    }
    Object.values(record).forEach(visit);
  };
  visit(input);
  return counts;
}

/** Read-only "your data" card shown first on Packaging Insights and features. */
export function DataSummary({
  input,
  savedAt,
}: {
  input: ScenarioInput;
  savedAt?: string | null;
}) {
  const machine = input.machines.at(0);
  const cycle =
    machine?.throughput.method === "cycle" ? machine.throughput : null;
  return (
    <section className="panel data-summary" aria-label="Your data">
      <div className="data-summary-head">
        <h2>Your data</h2>
        <Link to="/data">Edit data &amp; costs</Link>
      </div>
      <dl>
        <div>
          <dt>Production</dt>
          <dd>{show(input.monthlyProductionKg, " kg / month")}</dd>
        </div>
        <div>
          <dt>Pack sizes</dt>
          <dd>
            {input.formats
              .map(
                (f) =>
                  `${grams(f.portionWeightGrams)} (${show(f.allocationPercent, "%")})`,
              )
              .join(" · ")}
          </dd>
        </div>
        <div>
          <dt>Labour</dt>
          <dd>
            {input.labor.method === "perPackage"
              ? `${show(input.labor.euroPerPackage, "", 2)} € per pack`
              : `${show(input.labor.euroPerPersonHour, "", 2)} € per hour`}
          </dd>
        </div>
        {cycle && (
          <div>
            <dt>Machine</dt>
            <dd>
              {show(cycle.packagesPerCycle)} packs per{" "}
              {show(cycle.cycleSeconds, " s")} cycle
            </dd>
          </div>
        )}
      </dl>
      {savedAt && (
        <p className="data-sources" data-testid="data-saved">
          Last saved{" "}
          {new Date(savedAt).toLocaleString("en-GB", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
      )}
    </section>
  );
}
