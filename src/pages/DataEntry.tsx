import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Decimal } from "decimal.js";
import type { Quantity, ScenarioInput } from "../models/api";
import { missing } from "../../backend/src/domain/inputs";
import { useWorkspace } from "../components/WorkspaceProvider";
import { useRequest, RequestState, message } from "../components/AsyncState";
import { QuantityField as Q } from "../components/QuantityField";
import { ApiResults, money } from "../components/ApiResults";
import { DEMO_REFERENCE_NAME } from "../demo/apiDemo";
import { OG_TOFU, type Suggestion } from "../demo/ogTofuSuggestions";

const og = (s: Suggestion) => ({
  text: `${s.value} – OG TOFU${s.estimate ? " (estimate)" : ""}`,
  apply: s.quantity,
});

const ogPack = (index: number, key: "grams" | "share") => {
  const pack = OG_TOFU.packs.at(index);
  return pack ? og(pack[key]) : undefined;
};

/** OG TOFU's reported values (and labelled estimates) for every field. */
function ogTofuScenario(): ScenarioInput {
  const machineId = "machine-1";
  return {
    monthlyProductionKg: OG_TOFU.monthlyProductionKg.quantity(),
    formats: OG_TOFU.packs.map((pack, i) => ({
      id: `format-${i + 1}`,
      portionWeightGrams: pack.grams.quantity(),
      allocationPercent: pack.share.quantity(),
      materialCost: {
        method: "combined",
        combinedEuroPerPackage: OG_TOFU.materialEuroPerPack.quantity(),
      },
      machineId,
    })),
    machines: [
      {
        ...blankMachine(machineId),
        throughput: {
          method: "cycle",
          packagesPerCycle: OG_TOFU.packsPerCycle.quantity(),
          cycleSeconds: OG_TOFU.cycleSeconds.quantity(),
        },
        operators: OG_TOFU.operators.quantity(),
      },
    ],
    labor: {
      method: "perPackage",
      euroPerPackage: OG_TOFU.laborEuroPerPack.quantity(),
    },
    additionalOperatingEuroPerMonth: missing(),
  };
}

type Format = ScenarioInput["formats"][number];
type Machine = ScenarioInput["machines"][number];

const MAX_FORMATS = 20;

function newId(prefix: string, taken: string[]): string {
  for (let n = 1; ; n++) {
    const id = `${prefix}-${n}`;
    if (!taken.includes(id)) return id;
  }
}

function blankMachine(id: string): Machine {
  return {
    id,
    throughput: {
      method: "cycle",
      packagesPerCycle: missing(),
      cycleSeconds: missing(),
    },
    operators: missing(),
    investmentEuro: missing(),
    maintenanceEuroPerMonth: missing(),
    availableHoursPerMonth: missing(),
  };
}

function blankFormat(id: string, machineId: string): Format {
  return {
    id,
    portionWeightGrams: missing(),
    allocationPercent: missing(),
    materialCost: { method: "combined", combinedEuroPerPackage: missing() },
    machineId,
  };
}

/** A scenario the form can edit: at least one machine, every format assigned. */
function editable(input: ScenarioInput): ScenarioInput {
  const machines = input.machines.length
    ? input.machines
    : [blankMachine("machine-1")];
  const machineId = machines[0].id;
  const formats = input.formats.length
    ? input.formats
    : [blankFormat("format-1", machineId)];
  return {
    ...input,
    machines,
    formats: formats.map((f) => ({
      ...f,
      machineId: f.machineId ?? machineId,
    })),
  };
}

function blankScenario(): ScenarioInput {
  return editable({
    monthlyProductionKg: missing(),
    formats: [],
    machines: [],
    labor: { method: "perPackage", euroPerPackage: missing() },
    additionalOperatingEuroPerMonth: missing(),
  });
}

function shareTotal(formats: Format[]): Decimal | null {
  let sum = new Decimal(0);
  for (const f of formats) {
    if (f.allocationPercent.value === null) return null;
    sum = sum.plus(f.allocationPercent.value);
  }
  return sum;
}

/** Plain-language form for a company's own packaging data, with live results. */
export function DataEntry() {
  const { baseline, setBaseline, saveScenario, gateway, mode } = useWorkspace();
  const navigate = useNavigate();
  // The built-in demo example is not the visitor's data: start empty.
  const hasOwnData = !(
    mode === "demo" && baseline.name === DEMO_REFERENCE_NAME
  );
  const offerOg = mode === "demo";
  const [input, setInput] = useState(() =>
    hasOwnData ? editable(baseline.input) : blankScenario(),
  );
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const state = useRequest(JSON.stringify(input), () =>
    gateway.calculate(input),
  );

  const machine = input.machines[0];
  const change = (next: ScenarioInput) => {
    setInput(next);
    setStatus(null);
  };
  const updateMachine = (patch: Partial<Machine>) =>
    change({
      ...input,
      machines: input.machines.map((m, i) =>
        i === 0 ? { ...m, ...patch } : m,
      ),
    });
  const updateFormat = (index: number, patch: Partial<Format>) =>
    change({
      ...input,
      formats: input.formats.map((f, i) =>
        i === index ? { ...f, ...patch } : f,
      ),
    });
  const cycle =
    machine.throughput.method === "cycle"
      ? machine.throughput
      : {
          method: "cycle" as const,
          packagesPerCycle: missing(),
          cycleSeconds: missing(),
        };
  const total = shareTotal(input.formats);

  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">STEP 1 OF 5</span>
          <h1>Enter your data</h1>
          <p>
            Fill in what you know about your packaging. Leave a field empty if
            you don't know it: results that need it show as unknown, never as
            zero.
            {offerOg &&
              " To try the demo, click a value marked “OG TOFU” or fill everything at once."}
          </p>
        </div>
      </header>

      <div className="data-entry-actions">
        <button
          type="button"
          className="secondary"
          onClick={() => change(blankScenario())}
        >
          Clear all fields
        </button>
        {offerOg && (
          <button
            type="button"
            className="secondary"
            onClick={() => change(ogTofuScenario())}
          >
            Fill everything with OG TOFU data
          </button>
        )}
      </div>

      <section className="panel">
        <h2>1. Production</h2>
        <Q
          label="How many kilograms do you produce per month?"
          value={input.monthlyProductionKg}
          onChange={(monthlyProductionKg) =>
            change({ ...input, monthlyProductionKg })
          }
          suggestion={offerOg ? og(OG_TOFU.monthlyProductionKg) : undefined}
        />
      </section>

      <section className="panel">
        <h2>2. Pack sizes</h2>
        <p className="muted">
          Add each pack size you sell. The shares say how much of your monthly
          production, by weight, goes into each size, and must add up to 100%.
        </p>
        {input.formats.map((format, index) => (
          <fieldset key={format.id}>
            <legend>Pack size {index + 1}</legend>
            <div className="form-grid">
              <Q
                label={`Pack weight (g) · pack size ${index + 1}`}
                value={format.portionWeightGrams}
                onChange={(portionWeightGrams) =>
                  updateFormat(index, { portionWeightGrams })
                }
                suggestion={offerOg ? ogPack(index, "grams") : undefined}
              />
              <Q
                label={`Share of production (%) · pack size ${index + 1}`}
                value={format.allocationPercent}
                onChange={(allocationPercent) =>
                  updateFormat(index, { allocationPercent })
                }
                suggestion={offerOg ? ogPack(index, "share") : undefined}
              />
              {format.materialCost.method === "combined" ? (
                <Q
                  label={`Bag and label cost (€ per pack) · pack size ${index + 1}`}
                  value={format.materialCost.combinedEuroPerPackage}
                  onChange={(combinedEuroPerPackage) =>
                    updateFormat(index, {
                      materialCost: {
                        method: "combined",
                        combinedEuroPerPackage,
                      },
                    })
                  }
                  suggestion={
                    offerOg ? og(OG_TOFU.materialEuroPerPack) : undefined
                  }
                />
              ) : (
                <>
                  <Q
                    label={`Bag cost (€ per pack) · pack size ${index + 1}`}
                    value={format.materialCost.bagEuroPerPackage}
                    onChange={(bagEuroPerPackage) =>
                      format.materialCost.method === "itemized" &&
                      updateFormat(index, {
                        materialCost: {
                          ...format.materialCost,
                          bagEuroPerPackage,
                        },
                      })
                    }
                  />
                  <Q
                    label={`Label cost (€ per pack) · pack size ${index + 1}`}
                    value={format.materialCost.labelEuroPerPackage}
                    onChange={(labelEuroPerPackage) =>
                      format.materialCost.method === "itemized" &&
                      updateFormat(index, {
                        materialCost: {
                          ...format.materialCost,
                          labelEuroPerPackage,
                        },
                      })
                    }
                  />
                </>
              )}
            </div>
            {input.formats.length > 1 && (
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  change({
                    ...input,
                    formats: input.formats.filter((_, i) => i !== index),
                  })
                }
              >
                Remove pack size {index + 1}
              </button>
            )}
          </fieldset>
        ))}
        <p data-testid="share-total" className="muted">
          {total === null
            ? "Shares entered so far are incomplete."
            : total.eq(100)
              ? "Shares add up to 100%."
              : `Shares add up to ${total.toString()}%; they must total 100%.`}
        </p>
        {input.formats.length < MAX_FORMATS && (
          <button
            type="button"
            className="secondary"
            onClick={() =>
              change({
                ...input,
                formats: [
                  ...input.formats,
                  blankFormat(
                    newId(
                      "format",
                      input.formats.map((f) => f.id),
                    ),
                    machine.id,
                  ),
                ],
              })
            }
          >
            Add pack size
          </button>
        )}
      </section>

      <section className="panel">
        <h2>3. Packing labour</h2>
        <fieldset>
          <legend>How do you know your labour cost?</legend>
          <label className="radio-option">
            <input
              type="radio"
              name="labor-method"
              checked={input.labor.method === "perPackage"}
              onChange={() =>
                change({
                  ...input,
                  labor: { method: "perPackage", euroPerPackage: missing() },
                })
              }
            />
            I know the labour cost per pack
          </label>
          <label className="radio-option">
            <input
              type="radio"
              name="labor-method"
              checked={input.labor.method === "hourly"}
              onChange={() =>
                change({
                  ...input,
                  labor: { method: "hourly", euroPerPersonHour: missing() },
                })
              }
            />
            I know the hourly wage of the people packing
          </label>
        </fieldset>
        {input.labor.method === "perPackage" ? (
          <Q
            label="Labour cost (€ per pack)"
            value={input.labor.euroPerPackage}
            onChange={(euroPerPackage) =>
              change({
                ...input,
                labor: { method: "perPackage", euroPerPackage },
              })
            }
            suggestion={offerOg ? og(OG_TOFU.laborEuroPerPack) : undefined}
          />
        ) : (
          <Q
            label="Hourly wage including taxes (€ per hour)"
            value={input.labor.euroPerPersonHour}
            onChange={(euroPerPersonHour) =>
              change({
                ...input,
                labor: { method: "hourly", euroPerPersonHour },
              })
            }
          />
        )}
      </section>

      <section className="panel">
        <h2>4. Packing machine</h2>
        <p className="muted">
          Used to estimate packing hours. With an hourly wage, it also sets the
          labour cost.
        </p>
        <div className="form-grid">
          <Q
            label="Seconds per machine cycle"
            value={cycle.cycleSeconds}
            onChange={(cycleSeconds) =>
              updateMachine({ throughput: { ...cycle, cycleSeconds } })
            }
            suggestion={offerOg ? og(OG_TOFU.cycleSeconds) : undefined}
          />
          <Q
            label="Packs sealed per cycle"
            value={cycle.packagesPerCycle}
            onChange={(packagesPerCycle) =>
              updateMachine({ throughput: { ...cycle, packagesPerCycle } })
            }
            suggestion={offerOg ? og(OG_TOFU.packsPerCycle) : undefined}
          />
          <Q
            label="People operating the machine"
            value={machine.operators}
            onChange={(operators: Quantity) => updateMachine({ operators })}
            suggestion={offerOg ? og(OG_TOFU.operators) : undefined}
          />
          <Q
            label="Hours the machine is available per month"
            value={machine.availableHoursPerMonth}
            onChange={(availableHoursPerMonth) =>
              updateMachine({ availableHoursPerMonth })
            }
          />
        </div>
      </section>

      <section className="panel">
        <h2>Save</h2>
        <p className="muted">
          Saving makes these numbers your current operation, shown on the
          overview and used by the scenario simulator.
          {mode === "demo" && " In the demo they are stored in this browser."}
        </p>
        <button
          type="button"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            setStatus(null);
            try {
              const saved = await saveScenario(
                {
                  id: baseline.id,
                  name:
                    hasOwnData && baseline.name
                      ? baseline.name
                      : "My operation",
                  input,
                },
                baseline.id === null,
              );
              setBaseline(saved);
              navigate("/");
            } catch (e) {
              setStatus({ ok: false, text: message(e) });
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Saving…" : "Save and see my costs →"}
        </button>
        {status && (
          <p role={status.ok ? "status" : "alert"}>
            {status.text} {status.ok && <Link to="/">View overview</Link>}
          </p>
        )}
      </section>

      <section className="panel" aria-live="polite">
        <h2>Your results</h2>
        <RequestState
          error={state.error}
          loading={!state.data && !state.error}
        />
        {state.data && (
          <p data-testid="entry-total">
            Packaging cost: {money(state.data.totalPackagingOperatingEuro)} per
            month
          </p>
        )}
      </section>
      {state.data && <ApiResults result={state.data} input={input} />}
    </>
  );
}
