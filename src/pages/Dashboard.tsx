import { Link } from "react-router-dom";
import { useWorkspace } from "../components/WorkspaceProvider";
import { useRequest, RequestState } from "../components/AsyncState";
import { ApiResults } from "../components/ApiResults";
import { ScenarioPanel } from "../components/ScenarioPanel";
import { DataSummary } from "../components/DataSummary";
import { FeatureCards } from "../components/FeatureCards";
import { TestChange } from "../components/TestChange";
import { MissingInputs, Observations } from "../components/InsightSections";

/** Packaging Insights: costs, what they show, and the next decisions. */
export function Dashboard() {
  const { baseline, setBaseline, gateway, savedAt } = useWorkspace();
  const state = useRequest(JSON.stringify(baseline.input), () =>
    gateway.calculate(baseline.input),
  );
  const zero = baseline.input.monthlyProductionKg.value === "0";
  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">STEP 2 OF 2</span>
          <h1>Packaging Insights</h1>
          <p>
            What packaging costs you today, worked out from your saved data, and
            the decisions it points to.
          </p>
        </div>
        <div className="heading-actions">
          <Link to="/data" className="button">
            Edit data &amp; costs
          </Link>
          <Link to="/data#costs" className="button secondary">
            Edit material costs
          </Link>
          <Link to="/brief" className="button secondary">
            Decision brief
          </Link>
        </div>
      </header>
      <DataSummary input={baseline.input} savedAt={savedAt} />
      {zero && (
        <p className="notice" data-testid="zero-production">
          Monthly production is 0 kg, so packaging costs are 0 and cost per kg
          does not apply. Enter your production in Edit data &amp; costs to see
          real figures.
        </p>
      )}
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
          afterBreakdown={
            <>
              <Observations result={state.data} input={baseline.input} />
              <FeatureCards result={state.data} input={baseline.input} />
              <MissingInputs input={baseline.input} />
              <div id="test-change">
                <TestChange />
              </div>
            </>
          }
        />
      )}
      <details className="panel adjust-panel">
        <summary>Edit the whole scenario here (advanced)</summary>
        <ScenarioPanel
          title="Current operation"
          draft={baseline}
          onChange={setBaseline}
        />
      </details>
    </>
  );
}
