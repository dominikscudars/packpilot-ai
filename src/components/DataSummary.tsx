import { Link } from "react-router-dom";
import type { Quantity, ScenarioInput } from "../models/api";
import { decimalText } from "./ApiResults";

const show = (q: Quantity, unit = "", digits = 0) =>
  q.value === null ? "not entered" : `${decimalText(q.value, digits)}${unit}`;

/** Read-only "your data" card shown first on Packaging Insights and features. */
export function DataSummary({ input }: { input: ScenarioInput }) {
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
                  `${show(f.portionWeightGrams, " g")} (${show(f.allocationPercent, "%")})`,
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
    </section>
  );
}
