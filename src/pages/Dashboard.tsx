import { Link } from "react-router-dom";
import { useWorkspace } from "../components/WorkspaceProvider";
import { useRequest, RequestState } from "../components/AsyncState";
import { ApiResults } from "../components/ApiResults";
import { ScenarioPanel } from "../components/ScenarioPanel";
import { DataSummary } from "../components/DataSummary";
import { FeatureCards } from "../components/FeatureCards";

/** Step 2: the company's costs, then what it can do next. */
export function Dashboard() {
  const { baseline, setBaseline, gateway } = useWorkspace();
  const state = useRequest(JSON.stringify(baseline.input), () =>
    gateway.calculate(baseline.input),
  );
  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">STEP 2 OF 2</span>
          <h1>Packaging Insights</h1>
          <p>
            What packaging costs you today, worked out from your data. Below the
            figures, choose what you want to do next.
          </p>
        </div>
        <div className="heading-actions">
          <Link to="/data" className="button">
            Edit data &amp; costs
          </Link>
          <Link to="/data#costs" className="button secondary">
            Edit material costs
          </Link>
        </div>
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
