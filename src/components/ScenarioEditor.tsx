import type { ProductionScenario } from "../models/types";
import { assumed } from "../demo/ogTofu";
import { useWorkspace } from "./WorkspaceProvider";
import { NumericField } from "./NumericField";
export function ScenarioEditor({
  scenario,
  onChange,
  compact = false,
}: {
  scenario: ProductionScenario;
  onChange: (scenario: ProductionScenario) => void;
  compact?: boolean;
}) {
  const { workspace } = useWorkspace();
  function edit(mutator: (draft: ProductionScenario) => void) {
    const draft = structuredClone(scenario);
    mutator(draft);
    onChange(draft);
  }
  return (
    <div className="editor">
      {scenario.plans.map((plan, pi) => (
        <section key={plan.productId}>
          <NumericField
            label={`${workspace.products.find((p) => p.id === plan.productId)?.name ?? "Product"} monthly production (kg)`}
            input={plan.productionKg}
            onChange={(value) =>
              edit((d) => {
                d.plans[pi].productionKg = value;
              })
            }
          />
          {!compact && (
            <>
              <h3>Packaging mix & material prices</h3>
              <p className="muted">
                Shares are by weight and must total 100%. Prices include the bag
                and label.
              </p>
              <div className="format-edit-grid">
                {plan.allocations.map((allocation, ai) => (
                  <div className="format-editor" key={allocation.formatId}>
                    <h4>
                      {
                        workspace.formats.find(
                          (f) => f.id === allocation.formatId,
                        )?.name
                      }
                    </h4>
                    <NumericField
                      label={`${allocation.formatId} share (%)`}
                      percent
                      input={allocation.shareByWeight}
                      onChange={(value) =>
                        edit((d) => {
                          d.plans[pi].allocations[ai].shareByWeight = value;
                        })
                      }
                    />
                    <NumericField
                      label={`${allocation.formatId} material (€/package)`}
                      input={allocation.materialEuroPerPackage}
                      onChange={(value) =>
                        edit((d) => {
                          d.plans[pi].allocations[ai].materialEuroPerPackage =
                            value;
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      ))}
      {!compact && (
        <section className="labor-editor">
          <h3>Labor pricing</h3>
          <p className="muted">
            Select one cost method. Processing time is used to estimate hours in
            both methods.
          </p>
          <label htmlFor={`labor-${scenario.id}`}>Pricing method</label>
          <select
            id={`labor-${scenario.id}`}
            value={scenario.labor.method}
            onChange={(e) =>
              edit((d) => {
                d.labor =
                  e.target.value === "perPackage"
                    ? {
                        method: "perPackage",
                        euroPerPackage: assumed(
                          null,
                          "Enter a per-package labor rate.",
                        ),
                      }
                    : {
                        method: "perHour",
                        euroPerWorkerHour: assumed(
                          null,
                          "Enter an hourly wage; no wage was reported.",
                        ),
                      };
              })
            }
          >
            <option value="perPackage">Per package</option>
            <option value="perHour">Per worker-hour</option>
          </select>
          {scenario.labor.method === "perPackage" ? (
            <NumericField
              label="Labor rate (€/package)"
              input={scenario.labor.euroPerPackage}
              onChange={(value) =>
                edit((d) => {
                  d.labor = { method: "perPackage", euroPerPackage: value };
                })
              }
            />
          ) : (
            <NumericField
              label="Labor rate (€/worker-hour)"
              input={scenario.labor.euroPerWorkerHour}
              onChange={(value) =>
                edit((d) => {
                  d.labor = { method: "perHour", euroPerWorkerHour: value };
                })
              }
            />
          )}
        </section>
      )}
    </div>
  );
}
