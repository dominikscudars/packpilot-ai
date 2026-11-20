import { Link } from "react-router-dom";
import type { Quantity } from "../models/api";
import { useWorkspace } from "../components/WorkspaceProvider";
import { EXAMPLE_PROFILE } from "../demo/apiDemo";
import { useRequest, RequestState } from "../components/AsyncState";
import { money, decimalText } from "../components/ApiResults";
import { completeness, observations } from "../insights/insights";
import { toCsv } from "../insights/export";

const sizeLabel = (grams: number) =>
  grams >= 1000 && grams % 1000 === 0 ? `${grams / 1000} kg` : `${grams} g`;
const source = (q: Quantity) =>
  q.quality === "missing"
    ? "not entered"
    : q.quality === "assumption"
      ? "estimate"
      : q.quality;
const value = (q: Quantity, unit: string) =>
  q.value === null ? "Unknown" : `${q.value} ${unit}`;

/** One-page, printable decision brief for the active workspace only. */
export function Brief() {
  const { baseline, gateway, company, savedAt, lastComparison } =
    useWorkspace();
  const state = useRequest(JSON.stringify(baseline.input), () =>
    gateway.calculate(baseline.input),
  );
  const input = baseline.input;
  const machine = input.machines.at(0);
  const cycle =
    machine?.throughput.method === "cycle" ? machine.throughput : null;
  const inputs: [string, Quantity, string][] = [
    ["Monthly production", input.monthlyProductionKg, "kg"],
    ...input.formats.flatMap((f): [string, Quantity, string][] => {
      const name = sizeLabel(Number(f.portionWeightGrams.value));
      const cost = f.materialCost;
      return [
        [`${name}: share of production`, f.allocationPercent, "%"],
        cost.method === "combined"
          ? [
              `${name}: bag and label`,
              cost.combinedEuroPerPackage,
              "€ per pack",
            ]
          : [`${name}: bag`, cost.bagEuroPerPackage, "€ per pack"],
      ];
    }),
    input.labor.method === "perPackage"
      ? ["Labour", input.labor.euroPerPackage, "€ per pack"]
      : ["Labour", input.labor.euroPerPersonHour, "€ per hour"],
    ...(cycle
      ? ([
          ["Machine cycle", cycle.cycleSeconds, "seconds"],
          ["Packs per cycle", cycle.packagesPerCycle, "packs"],
        ] as [string, Quantity, string][])
      : []),
  ];
  const today = new Date().toISOString().slice(0, 10);
  const comparison =
    lastComparison && lastComparison.key === JSON.stringify(input)
      ? lastComparison
      : null;

  function download() {
    if (!state.data) return;
    const r = state.data;
    const rows: (string | number | null)[][] = [
      ["PackPilot decision brief", company.name, today],
      [],
      ["Input", "Value", "Unit", "Source"],
      ...inputs.map(([label, q, unit]) => [label, q.value, unit, source(q)]),
      [],
      ["Result", "Value", "Unit"],
      ["Packaging cost", r.totalPackagingOperatingEuro, "€ per month"],
      ["Materials", r.totalMaterialEuro, "€ per month"],
      ["Labour", r.totalLaborEuro, "€ per month"],
      ["Cost per kg", r.packagingEuroPerPlannedKg, "€ per kg"],
      ["Packages", r.totalPackages, "packs per month"],
      ["Machine-hours", r.machineHours, "hours per month"],
      [],
      ["Pack size", "Packages", "€ per packed kg"],
      ...r.rows.map((row) => [
        sizeLabel(
          Number(
            input.formats.find((f) => f.id === row.formatId)?.portionWeightGrams
              .value,
          ),
        ),
        row.packages,
        row.packagingEuroPerPackedKg,
      ]),
      [],
      ["Exclusions"],
      ...(r.exclusions ?? []).map((e) => [e]),
    ];
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `packpilot-brief-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <article className="brief">
      <header className="page-heading no-print-actions">
        <div>
          <span className="eyebrow">DECISION BRIEF</span>
          <h1>Packaging decision brief</h1>
          {baseline.name === EXAMPLE_PROFILE && (
            <p className="badge example-badge" data-testid="example-profile">
              Example data: OG TOFU
            </p>
          )}
          <p>
            {company.name} · prepared {today}
            {savedAt &&
              ` · inputs saved ${new Date(savedAt).toISOString().slice(0, 10)}`}
          </p>
        </div>
        <div className="heading-actions">
          <button type="button" onClick={() => window.print()}>
            Print / save as PDF
          </button>
          <button
            type="button"
            className="secondary"
            disabled={!state.data}
            onClick={download}
          >
            Download CSV
          </button>
          <Link to="/" className="button secondary">
            Back to workspace
          </Link>
        </div>
      </header>
      <RequestState
        error={state.error}
        onRetry={state.retry}
        guidance={state.guidance}
        loading={!state.data && !state.error}
      />
      {state.data && (
        <>
          <section className="panel">
            <h2>Results</h2>
            <p data-testid="brief-total">
              Packaging cost{" "}
              <strong>{money(state.data.totalPackagingOperatingEuro)}</strong>{" "}
              per month (materials {money(state.data.totalMaterialEuro)}, labour{" "}
              {money(state.data.totalLaborEuro)}) ·{" "}
              {money(state.data.packagingEuroPerPlannedKg, 3)} per kg ·{" "}
              {decimalText(state.data.totalPackages, 0)} packs ·{" "}
              {decimalText(state.data.machineHours, 1)} machine-hours.
            </p>
            <table>
              <thead>
                <tr>
                  <th scope="col">Pack size</th>
                  <th scope="col">Packs / month</th>
                  <th scope="col">€ per packed kg</th>
                </tr>
              </thead>
              <tbody>
                {state.data.rows.map((row) => (
                  <tr key={row.formatId}>
                    <th scope="row">
                      {sizeLabel(
                        Number(
                          input.formats.find((f) => f.id === row.formatId)
                            ?.portionWeightGrams.value,
                        ),
                      )}
                    </th>
                    <td>{decimalText(row.packages, 0)}</td>
                    <td>{money(row.packagingEuroPerPackedKg, 3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul>
              {observations(state.data, input).map((o) => (
                <li key={o.id}>{o.text}</li>
              ))}
            </ul>
          </section>
          {comparison && (
            <section className="panel" data-testid="brief-comparison">
              <h2>Evaluated change</h2>
              <p>
                Packaging cost{" "}
                {money(comparison.data.baseline.totalPackagingOperatingEuro)} →{" "}
                {money(comparison.data.alternative.totalPackagingOperatingEuro)}{" "}
                per month; cost per kg{" "}
                {money(comparison.data.baseline.packagingEuroPerPlannedKg, 3)} →{" "}
                {money(
                  comparison.data.alternative.packagingEuroPerPlannedKg,
                  3,
                )}
                .
                {comparison.data.comparableForSavings &&
                comparison.data.monthlyNetSavingsEuro !== null
                  ? ` Modelled net change in running costs: ${money(comparison.data.monthlyNetSavingsEuro)} per month.`
                  : " Savings not shown: the comparison is incomplete or production differs."}
              </p>
            </section>
          )}
          <section className="panel">
            <h2>Inputs and sources</h2>
            <table>
              <tbody>
                {inputs.map(([label, q, unit]) => (
                  <tr key={label}>
                    <th scope="row">{label}</th>
                    <td>{value(q, unit)}</td>
                    <td className="muted">{source(q)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section className="panel">
            <h2>Assumptions, exclusions and missing inputs</h2>
            <ul>
              {(state.data.exclusions ?? []).map((e) => (
                <li key={e}>{e}</li>
              ))}
              {completeness(input).map((m) => (
                <li key={m.needs}>
                  Missing for {m.decision.toLowerCase()}: {m.needs}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </article>
  );
}
