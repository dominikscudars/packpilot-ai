import { Link, Navigate } from "react-router-dom";
import { DEMO_REFERENCE_NAME } from "../demo/apiDemo";
import { useWorkspace } from "../components/WorkspaceProvider";
import { useRequest, RequestState } from "../components/AsyncState";
import { ApiResults } from "../components/ApiResults";
import { ScenarioPanel } from "../components/ScenarioPanel";
import { DataSummary } from "../components/DataSummary";
import { FeatureCards } from "../components/FeatureCards";

/** Step 2: the company's costs, then what it can do next. */
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
          <span className="eyebrow">STEP 2 OF 2 · YOUR RESULTS</span>
          <h1>Your costs</h1>
          <p>
            What packaging costs you today, worked out from your data. Below the
            figures, choose what you want to do next.
          </p>
        </div>
        <Link to="/data" className="button secondary">
          Change my data
        </Link>
      </header>
      <DataSummary input={baseline.input} />
      <RequestState
        error={state.error}
        onRetry={state.retry}
        guidance={state.guidance}
        loading={!state.data && !state.error}
      />
      {state.data && (
        <ApiResults
          result={state.data}
          input={baseline.input}
          afterMetrics={
            <FeatureCards result={state.data} input={baseline.input} />
          }
        />
      )}
      <details className="panel adjust-panel">
        <summary>Try different numbers here (advanced)</summary>
        <ScenarioPanel
          title="Current operation"
          draft={baseline}
          onChange={setBaseline}
        />
      </details>
    </>
  );
}
