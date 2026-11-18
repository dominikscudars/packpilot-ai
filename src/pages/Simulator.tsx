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
export function Simulator() {
  const { baseline, alternative, setAlternative, gateway } = useWorkspace();
  const [sameDemand, setSameDemand] = useState(false);
  const state = useRequest(
    JSON.stringify([baseline.input, alternative.input, sameDemand]),
    () => gateway.compare(baseline.input, alternative.input, sameDemand),
  );
  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">EXPLORE THE POSSIBILITIES</span>
          <h1>Scenario simulator</h1>
          <p>
            Compare an independent alternative against the current overview
            draft: {baseline.name}.
          </p>
        </div>
        <button
          className="secondary"
          onClick={() => {
            setAlternative({
              id: null,
              name: "Alternative scenario",
              input: structuredClone(baseline.input),
            });
            setSameDemand(false);
          }}
        >
          Copy current inputs
        </button>
      </header>
      <label className="check-label">
        <input
          type="checkbox"
          checked={sameDemand}
          onChange={(e) => setSameDemand(e.target.checked)}
        />
        I confirm both scenarios represent the same product and demand.
      </label>
      <RequestState
        error={state.error}
        onRetry={state.retry}
        loading={!state.data && !state.error}
      />
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
          <Notes data={state.data} />
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
    </>
  );
}
