import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import { useWorkspace } from "../components/WorkspaceProvider";
import { useRequest, RequestState } from "../components/AsyncState";
import { ApiResults } from "../components/ApiResults";
import { ScenarioPanel } from "../components/ScenarioPanel";
export function Dashboard() {
  const { baseline, setBaseline, gateway, mode } = useWorkspace();
  const state = useRequest(JSON.stringify(baseline.input), () =>
    gateway.calculate(baseline.input),
  );
  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">YOUR OPERATIONS, AT A GLANCE</span>
          <h1>Overview</h1>
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
    </>
  );
}
