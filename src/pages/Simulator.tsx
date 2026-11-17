import { useWorkspace } from "../components/WorkspaceProvider";
import { ScenarioEditor } from "../components/ScenarioEditor";
import { Results, evaluate, euro, number } from "../components/Results";
import { compareScenarios } from "../optimization/compareScenarios";
export function Simulator() {
  const { workspace, update } = useWorkspace();
  const baseline = evaluate(workspace.baseline, workspace);
  const alternative = evaluate(workspace.alternative, workspace);
  const comparison =
    baseline.result && alternative.result
      ? compareScenarios(baseline.result, alternative.result)
      : null;
  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">EXPLORE THE POSSIBILITIES</span>
          <h1>Scenario simulator</h1>
          <p>
            Adjust an alternative and compare it with your current operation.
          </p>
        </div>
        <button
          className="button secondary"
          onClick={() =>
            update({
              ...workspace,
              alternative: {
                ...structuredClone(workspace.baseline),
                id: "alternative",
                name: "Alternative scenario",
              },
            })
          }
        >
          Copy current inputs
        </button>
      </header>
      <div className="notice">
        Alternative inputs are saved separately. Machine timing and staffing
        come from the shared company profile.
      </div>
      <section className="panel">
        <ScenarioEditor
          scenario={workspace.alternative}
          onChange={(alternative) => update({ ...workspace, alternative })}
        />
      </section>
      {alternative.error && (
        <div role="alert" className="error">
          {alternative.error}
        </div>
      )}
      {baseline.error && (
        <div role="alert" className="error">
          Current operation: {baseline.error}
        </div>
      )}
      {comparison && baseline.result && alternative.result && (
        <section className="panel comparison">
          <div>
            <span className="eyebrow">CURRENT OPERATION</span>
            <strong>{euro(baseline.result.operatingEuro)}</strong>
            <small>{number(baseline.result.productionKg, 2)} kg / month</small>
          </div>
          <span aria-hidden="true">→</span>
          <div>
            <span className="eyebrow">ALTERNATIVE</span>
            <strong>{euro(alternative.result.operatingEuro)}</strong>
            <small>
              {number(alternative.result.productionKg, 2)} kg / month
            </small>
          </div>
          <div>
            <span className="eyebrow">MONTHLY COST CHANGE</span>
            <strong>{euro(comparison.operatingCostDifferenceEuro)}</strong>
            <small>
              {comparison.comparableVolume
                ? "At equal production volume"
                : "Different production volumes; not a like-for-like saving"}
            </small>
          </div>
        </section>
      )}
      {alternative.result && (
        <Results result={alternative.result} catalog={workspace} />
      )}
    </>
  );
}
