import { Link, Navigate } from "react-router-dom";
import { DEMO_REFERENCE_NAME } from "../demo/apiDemo";
import { Icon } from "../components/Icon";
import { useWorkspace } from "../components/WorkspaceProvider";
import { useRequest, RequestState } from "../components/AsyncState";
import { ApiResults } from "../components/ApiResults";
import { ScenarioPanel } from "../components/ScenarioPanel";
import { NextStep } from "../components/NextStep";
export function Dashboard() {
  const { baseline, setBaseline, gateway, mode } = useWorkspace();
  const state = useRequest(JSON.stringify(baseline.input), () =>
    gateway.calculate(baseline.input),
  );
  // Step 1 comes first: the built-in demo example is not the visitor's data.
  if (mode === "demo" && baseline.name === DEMO_REFERENCE_NAME)
    return <Navigate to="/data" replace />;
  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">STEP 2 OF 5</span>
          <h1>Your costs</h1>
          <p>
            {mode === "demo"
              ? "A clearer view of your packaging costs. Explore the hypothetical pilot inputs."
              : "Review costs and production for your selected company."}
          </p>
        </div>
        <Link to="/simulator" className="button">
          <Icon name="simulator" /> Explore scenarios <Icon name="arrow" />
        </Link>
      </header>
      <RequestState
        error={state.error}
        onRetry={state.retry}
        loading={!state.data && !state.error}
      />
      {state.data && <ApiResults result={state.data} input={baseline.input} />}
      <ScenarioPanel
        title="Current operation"
        draft={baseline}
        onChange={setBaseline}
      />
      <NextStep to="/simulator" label="compare scenarios" />
    </>
  );
}
