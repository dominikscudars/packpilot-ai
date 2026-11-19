import { Link } from "react-router-dom";
import type { PackagingCostResult, ScenarioInput } from "../models/api";
import { completeness, observations } from "../insights/insights";

/** Two or three observations calculated from the results. */
export function Observations({
  result,
  input,
}: {
  result: PackagingCostResult;
  input: ScenarioInput;
}) {
  const items = observations(result, input);
  if (items.length === 0) return null;
  return (
    <section className="panel observations" aria-label="What the numbers show">
      <h2>What the numbers show</h2>
      <ul>
        {items.map((o) => (
          <li key={o.id}>{o.text}</li>
        ))}
      </ul>
      <p className="footnote">
        Calculated from your inputs; not a guaranteed saving.
      </p>
    </section>
  );
}

/** Which missing inputs block which decisions, with links to the fields. */
export function MissingInputs({ input }: { input: ScenarioInput }) {
  const items = completeness(input);
  if (items.length === 0)
    return (
      <p className="notice complete-note" data-testid="inputs-complete">
        All inputs used by these calculations are filled in.
      </p>
    );
  const decisions = [...new Set(items.map((i) => i.decision))];
  return (
    <section className="panel missing-inputs" aria-label="What is missing">
      <h2>What is missing</h2>
      <p className="muted">
        Filling these in unlocks more of PackPilot. Start at the top: each item
        is the next useful measurement or quote.
      </p>
      <ol>
        {decisions.map((decision) => (
          <li key={decision}>
            <strong>{decision}</strong> needs:
            <ul>
              {items
                .filter((i) => i.decision === decision)
                .map((i) => (
                  <li key={i.needs}>
                    <Link to={`/data#${i.field}`}>{i.needs}</Link>
                  </li>
                ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}
