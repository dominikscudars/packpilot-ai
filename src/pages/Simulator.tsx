import { useState } from "react";
import { useWorkspace } from "../components/WorkspaceProvider";
import { useRequest, RequestState } from "../components/AsyncState";
import {
  ApiResults,
  Notes,
  money,
  decimalText,
} from "../components/ApiResults";
import { ScenarioPanel } from "../components/ScenarioPanel";
import { NextStep } from "../components/NextStep";
import { assumed } from "../../backend/src/domain/inputs";
import type { ScenarioInput } from "../models/api";
/** Plain-English versions of the comparison engine's warnings; unknown text is shown as-is. */
export const FRIENDLY_WARNINGS: Record<string, string> = {
  "Production volumes differ. Total expenditure changes are not savings; compare unit economics separately.":
    "Tip: The two scenarios pack different amounts. Match monthly production (kg) to see savings, or compare cost per kg below.",
  "Consistent product and demand assumptions have not been confirmed.":
    "Tip: Tick “same product and demand” above when both scenarios describe the same product and the same orders.",
  "One or both scenarios leave production unpackaged; savings and payback are not comparable.":
    "Tip: One scenario cannot pack everything in its available machine-hours. Add machine time or lower production to see savings.",
  "Zero production does not support a demand-backed investment comparison.":
    "Tip: Enter a monthly production above 0 kg to compare scenarios.",
  "Net savings require comparable fulfilled production and complete recurring operating cost inputs.":
    "Tip: Net savings appear once both scenarios pack the same monthly output and their running costs (maintenance and other monthly costs) are filled in. Until then, compare cost per kg below.",
  "No positive monthly net savings; no positive payback period is calculated.":
    "This alternative does not lower monthly costs, so there is no payback period.",
};
const ZERO_NOTE =
  "Set to €0 by “Auto-fill comparable inputs”; replace with your real figure.";
/** Fills only unknown running costs with an explicit €0 assumption; known values are kept. */
export function fillRunningCosts(input: ScenarioInput): ScenarioInput {
  const fill = <T extends { value: string | null }>(q: T) =>
    q.value === null ? assumed("0", ZERO_NOTE) : q;
  return {
    ...input,
    additionalOperatingEuroPerMonth: fill(
      input.additionalOperatingEuroPerMonth,
    ),
    machines: input.machines.map((m) => ({
      ...m,
      maintenanceEuroPerMonth: fill(m.maintenanceEuroPerMonth),
    })),
  };
}
export function Simulator() {
  const { baseline, alternative, setAlternative, setBaseline, gateway } =
    useWorkspace();
  const comparisonKey = JSON.stringify([baseline.input, alternative.input]);
  // An untouched copy of the baseline is the same product and demand by construction.
  const [confirmedInputs, setConfirmedInputs] = useState<string | null>(() =>
    JSON.stringify(baseline.input) === JSON.stringify(alternative.input)
      ? comparisonKey
      : null,
  );
  const sameDemand = confirmedInputs === comparisonKey;
  const state = useRequest(
    JSON.stringify([baseline.input, alternative.input, sameDemand]),
    () => gateway.compare(baseline.input, alternative.input, sameDemand),
  );
  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">STEP 3 OF 5</span>
          <h1>Scenario simulator</h1>
          <p>
            Compare an independent alternative against the current overview
            draft: {baseline.name}.
          </p>
        </div>
        <button
          className="secondary"
          onClick={() => {
            const input = structuredClone(baseline.input);
            setAlternative({ id: null, name: "Alternative scenario", input });
            setConfirmedInputs(JSON.stringify([baseline.input, input]));
          }}
        >
          Copy current inputs
        </button>
      </header>
      <label className="check-label">
        <input
          type="checkbox"
          checked={sameDemand}
          onChange={(e) =>
            setConfirmedInputs(e.target.checked ? comparisonKey : null)
          }
        />
        I confirm both scenarios represent the same product and demand.
      </label>
      <RequestState
        error={state.error}
        onRetry={state.retry}
        loading={!state.data && !state.error}
      />
      {state.data && state.data.monthlyNetSavingsEuro === null && (
        <div className="actions">
          <button
            className="secondary"
            onClick={() => {
              const base = fillRunningCosts(baseline.input);
              const alt = fillRunningCosts({
                ...alternative.input,
                monthlyProductionKg: base.monthlyProductionKg,
              });
              setBaseline({ ...baseline, input: base });
              setAlternative({ ...alternative, input: alt });
              setConfirmedInputs(JSON.stringify([base, alt]));
            }}
          >
            Auto-fill comparable inputs
          </button>
          <span className="muted">
            Matches the alternative&apos;s monthly production to the current
            operation, confirms same demand and sets unknown running costs to €0
            as labelled assumptions.
          </span>
        </div>
      )}
      {state.data && (
        <>
          <section className="panel">
            <h2>Comparison</h2>
            <p>
              Current packaging cost:{" "}
              {money(state.data.baseline.totalPackagingOperatingEuro)} ·
              Alternative:{" "}
              {money(state.data.alternative.totalPackagingOperatingEuro)}
            </p>
            <p>
              Change in monthly packaging expenditure:{" "}
              <strong>
                {money(state.data.differences.totalPackagingEuro.absolute)}
              </strong>
            </p>
            <p>
              Monthly net savings including recurring costs:{" "}
              <strong>{money(state.data.monthlyNetSavingsEuro)}</strong>
            </p>
            <p>
              Simple payback: {decimalText(state.data.simplePaybackMonths)}{" "}
              months
            </p>
          </section>
          <Notes
            data={{
              ...state.data,
              warnings: state.data.warnings.map(
                (w) => FRIENDLY_WARNINGS[w] ?? w,
              ),
            }}
          />
          <ApiResults
            result={state.data.alternative}
            input={alternative.input}
          />
        </>
      )}
      <ScenarioPanel
        title="Alternative scenario"
        draft={alternative}
        onChange={setAlternative}
      />
      <NextStep to="/inventory" label="plan your packaging stock" />
    </>
  );
}
