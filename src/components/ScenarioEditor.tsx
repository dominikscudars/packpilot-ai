import type { ScenarioInput } from "../models/api";
import { QuantityField as Q } from "./QuantityField";
import { missing } from "../../backend/src/domain/inputs";
import { useWorkspace } from "./WorkspaceProvider";
export function ScenarioEditor({
  scenario,
  onChange,
  compact = false,
}: {
  scenario: ScenarioInput;
  onChange: (scenario: ScenarioInput) => void;
  compact?: boolean;
}) {
  const { catalog } = useWorkspace();
  return (
    <div className="scenario-editor">
      <Q
        label="Monthly production (kg)"
        value={scenario.monthlyProductionKg}
        onChange={(monthlyProductionKg) =>
          onChange({ ...scenario, monthlyProductionKg })
        }
      />
      {!compact && (
        <>
          <h3>Format mix · percentage of production weight</h3>
          <p className="muted">
            Shares must total exactly 100%. Empty values remain unknown. Edits
            are assumptions. Each scenario stores its own input snapshot.
          </p>
          {scenario.formats.map((format, index) => {
            const update = (patch: Partial<typeof format>) =>
              onChange({
                ...scenario,
                formats: scenario.formats.map((f, i) =>
                  i === index ? { ...f, ...patch } : f,
                ),
              });
            const catalogFormat = catalog.formats.find(
              (f) => f.id === format.id,
            );
            const product = catalog.products.find(
              (p) => p.id === catalogFormat?.productId,
            );
            return (
              <fieldset key={format.id}>
                <legend>
                  {product?.name ?? "Product"} ·{" "}
                  {format.portionWeightGrams.value ?? "?"} g
                </legend>
                <div className="form-grid">
                  <Q
                    label={`Portion weight (g) · ${index + 1}`}
                    value={format.portionWeightGrams}
                    onChange={(portionWeightGrams) =>
                      update({ portionWeightGrams })
                    }
                  />
                  <Q
                    label={`Weight share (%) · ${index + 1}`}
                    value={format.allocationPercent}
                    onChange={(allocationPercent) =>
                      update({ allocationPercent })
                    }
                  />
                  <label>
                    Material pricing
                    <select
                      value={format.materialCost.method}
                      onChange={(e) =>
                        update({
                          materialCost:
                            e.target.value === "combined"
                              ? {
                                  method: "combined",
                                  combinedEuroPerPackage: missing(),
                                }
                              : {
                                  method: "itemized",
                                  bagEuroPerPackage: missing(),
                                  labelEuroPerPackage: missing(),
                                },
                        })
                      }
                    >
                      <option value="combined">Combined bag and label</option>
                      <option value="itemized">Separate bag and label</option>
                    </select>
                  </label>
                  {format.materialCost.method === "combined" ? (
                    <Q
                      label={`Materials and labels (€/package) · ${index + 1}`}
                      value={format.materialCost.combinedEuroPerPackage}
                      onChange={(combinedEuroPerPackage) =>
                        update({
                          materialCost: {
                            method: "combined",
                            combinedEuroPerPackage,
                          },
                        })
                      }
                    />
                  ) : (
                    <>
                      <Q
                        label={`Bag (€/package) · ${index + 1}`}
                        value={format.materialCost.bagEuroPerPackage}
                        onChange={(bagEuroPerPackage) => {
                          if (format.materialCost.method === "itemized")
                            update({
                              materialCost: {
                                ...format.materialCost,
                                bagEuroPerPackage,
                              },
                            });
                        }}
                      />
                      <Q
                        label={`Label (€/package) · ${index + 1}`}
                        value={format.materialCost.labelEuroPerPackage}
                        onChange={(labelEuroPerPackage) => {
                          if (format.materialCost.method === "itemized")
                            update({
                              materialCost: {
                                ...format.materialCost,
                                labelEuroPerPackage,
                              },
                            });
                        }}
                      />
                    </>
                  )}
                  <label>
                    Assigned machine
                    <select
                      value={format.machineId ?? ""}
                      onChange={(e) =>
                        update({ machineId: e.target.value || null })
                      }
                    >
                      <option value="">Unknown / unassigned</option>
                      {scenario.machines.map((m) => (
                        <option key={m.id} value={m.id}>
                          {catalog.machines.find((c) => c.id === m.id)?.model ??
                            m.id}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </fieldset>
            );
          })}
          <fieldset>
            <legend>Labor and recurring operating costs</legend>
            <div className="form-grid">
              <label>
                Labor pricing method
                <select
                  value={scenario.labor.method}
                  onChange={(e) =>
                    onChange({
                      ...scenario,
                      labor:
                        e.target.value === "hourly"
                          ? { method: "hourly", euroPerPersonHour: missing() }
                          : { method: "perPackage", euroPerPackage: missing() },
                    })
                  }
                >
                  <option value="perPackage">Per package</option>
                  <option value="hourly">Per person-hour</option>
                </select>
              </label>
              {scenario.labor.method === "perPackage" ? (
                <Q
                  label="Labor (€/package)"
                  value={scenario.labor.euroPerPackage}
                  onChange={(euroPerPackage) =>
                    onChange({
                      ...scenario,
                      labor: { method: "perPackage", euroPerPackage },
                    })
                  }
                />
              ) : (
                <Q
                  label="Labor (€/person-hour)"
                  value={scenario.labor.euroPerPersonHour}
                  onChange={(euroPerPersonHour) =>
                    onChange({
                      ...scenario,
                      labor: { method: "hourly", euroPerPersonHour },
                    })
                  }
                />
              )}
              <Q
                label="Additional operating costs (€/month)"
                value={scenario.additionalOperatingEuroPerMonth}
                onChange={(additionalOperatingEuroPerMonth) =>
                  onChange({ ...scenario, additionalOperatingEuroPerMonth })
                }
              />
            </div>
          </fieldset>
          {scenario.machines.map((machine, index) => {
            const update = (patch: Partial<typeof machine>) =>
              onChange({
                ...scenario,
                machines: scenario.machines.map((m, i) =>
                  i === index ? { ...m, ...patch } : m,
                ),
              });
            return (
              <fieldset key={machine.id}>
                <legend>
                  {catalog.machines.find((m) => m.id === machine.id)?.model ??
                    machine.id}
                </legend>
                <div className="form-grid">
                  <label>
                    Throughput method
                    <select
                      value={machine.throughput.method}
                      onChange={(e) =>
                        update({
                          throughput:
                            e.target.value === "cycle"
                              ? {
                                  method: "cycle",
                                  packagesPerCycle: missing(),
                                  cycleSeconds: missing(),
                                }
                              : { method: "rate", packagesPerHour: missing() },
                        })
                      }
                    >
                      <option value="cycle">Cycle</option>
                      <option value="rate">Hourly rate</option>
                    </select>
                  </label>
                  {machine.throughput.method === "cycle" ? (
                    <>
                      <Q
                        label="Packages per cycle"
                        value={machine.throughput.packagesPerCycle}
                        onChange={(packagesPerCycle) => {
                          if (machine.throughput.method === "cycle")
                            update({
                              throughput: {
                                ...machine.throughput,
                                packagesPerCycle,
                              },
                            });
                        }}
                      />
                      <Q
                        label="Cycle duration (seconds)"
                        value={machine.throughput.cycleSeconds}
                        onChange={(cycleSeconds) => {
                          if (machine.throughput.method === "cycle")
                            update({
                              throughput: {
                                ...machine.throughput,
                                cycleSeconds,
                              },
                            });
                        }}
                      />
                    </>
                  ) : (
                    <Q
                      label="Throughput (packages/hour)"
                      value={machine.throughput.packagesPerHour}
                      onChange={(packagesPerHour) =>
                        update({
                          throughput: { method: "rate", packagesPerHour },
                        })
                      }
                    />
                  )}
                  <Q
                    label="Operators (people)"
                    value={machine.operators}
                    onChange={(operators) => update({ operators })}
                  />
                  <Q
                    label="Investment (€)"
                    value={machine.investmentEuro}
                    onChange={(investmentEuro) => update({ investmentEuro })}
                  />
                  <Q
                    label="Maintenance (€/month)"
                    value={machine.maintenanceEuroPerMonth}
                    onChange={(maintenanceEuroPerMonth) =>
                      update({ maintenanceEuroPerMonth })
                    }
                  />
                  <Q
                    label="Available machine-hours/month"
                    value={machine.availableHoursPerMonth}
                    onChange={(availableHoursPerMonth) =>
                      update({ availableHoursPerMonth })
                    }
                  />
                </div>
              </fieldset>
            );
          })}
        </>
      )}
    </div>
  );
}
