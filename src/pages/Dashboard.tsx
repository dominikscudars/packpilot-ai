import { Link } from "react-router-dom";
import { useWorkspace } from "../components/WorkspaceProvider";
import { ScenarioEditor } from "../components/ScenarioEditor";
import { Results, evaluate } from "../components/Results";
export function Dashboard() {
  const { workspace, update } = useWorkspace();
  const { result, error } = evaluate(workspace.baseline, workspace);
  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">YOUR PACKAGING OPERATIONS</span>
          <h1>Overview</h1>
          <p>A clearer view of your packaging costs, one input at a time.</p>
        </div>
        <Link className="button" to="/simulator">
          Explore a scenario <span aria-hidden="true">→</span>
        </Link>
      </header>
      <div className="notice">
        <strong>OG TOFU demonstration</strong>
        <span>
          The original demo mix of 80% / 15% / 5% is hypothetical. Prices and
          production are estimates; edited values are assumptions.
        </span>
      </div>
      <section className="panel production-bar">
        <div>
          <span className="eyebrow">MONTHLY PRODUCTION</span>
          <h2>Plan your next month</h2>
          <p className="muted">
            Change volume to recalculate your current operation.
          </p>
        </div>
        <ScenarioEditor
          compact
          scenario={workspace.baseline}
          onChange={(baseline) => update({ ...workspace, baseline })}
        />
      </section>
      {error && (
        <div className="error" role="alert">
          {error} <Link to="/company">Review profile inputs</Link>
        </div>
      )}
      {result && <Results result={result} catalog={workspace} />}
      <section className="insight-strip">
        <div className="insight-icon" aria-hidden="true">
          i
        </div>
        <div>
          <h3>Good decisions start with clear assumptions.</h3>
          <p>
            Labor hours assume the recorded cycle time and staffing for each
            format. Setup, cleaning and downtime are not included.
          </p>
        </div>
        <Link to="/company">Review inputs →</Link>
      </section>
    </>
  );
}
