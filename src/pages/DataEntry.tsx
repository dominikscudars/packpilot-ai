import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Decimal } from "decimal.js";
import type { Quantity, ScenarioInput } from "../models/api";
import { assumed, missing } from "../../backend/src/domain/inputs";
import { useWorkspace } from "../components/WorkspaceProvider";
import { message } from "../components/AsyncState";
import { QuantityField as Q } from "../components/QuantityField";
import { OG_TOFU, type Suggestion } from "../demo/ogTofuSuggestions";
import { fieldIds, setupProblems } from "../setup/setupState";
import { parseTable } from "../survey/tabulate";
import { buildForecast, headerGrams } from "../forecast/forecast";

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
    try {
      sum = sum.plus(f.allocationPercent.value);
    } catch {
      return null;
    }
  }
  return sum;
}

/**
 * Applies the latest month of a pasted sales table to the form: production
 * from the last month, pack mix from the last three months. Pack sizes named
 * in the headings are added if the form does not have them yet.
 */
function importSales(
  input: ScenarioInput,
  text: string,
  unit: "packs" | "kg",
): { input: ScenarioInput } | { error: string } {
  const rows = parseTable(text);
  const headerSizes = (rows.at(0) ?? [])
    .slice(1)
    .map(headerGrams)
    .filter((g): g is number => g !== null && g > 0);
  if (headerSizes.length === 0)
    return {
      error:
        "No pack-size columns found. Use headings such as “1 kg”, “500 g” or “250 g”.",
    };
  const machineId = input.machines[0]?.id ?? "machine-1";
  let formats = input.formats.filter(
    (f) => Number(f.portionWeightGrams.value) > 0,
  );
  for (const grams of headerSizes)
    if (!formats.some((f) => Number(f.portionWeightGrams.value) === grams))
      formats = [
        ...formats,
        {
          ...blankFormat(
            newId(
              "format",
              formats.map((f) => f.id),
            ),
            machineId,
          ),
          portionWeightGrams: assumed(
            String(grams),
            "Pack size from the imported spreadsheet.",
          ),
        },
      ];
  const result = buildForecast(
    rows,
    formats.map((f) => ({
      id: f.id,
      grams: Number(f.portionWeightGrams.value),
    })),
    unit,
  );
  const last = result.history.at(-1);
  if (!last)
    return { error: "No month with numbers was found under those headings." };
  const note = `Imported from your spreadsheet (${last.label}).`;
  return {
    input: {
      ...input,
      monthlyProductionKg: assumed(String(Math.round(last.totalKg)), note),
      formats: formats.map((f) =>
        result.shares[f.id] === undefined
          ? { ...f, allocationPercent: assumed("0", note) }
          : {
              ...f,
              allocationPercent: assumed(
                String(result.shares[f.id]),
                "Average pack mix of the last three imported months.",
              ),
            },
      ),
    },
  };
}

/**
 * Data entry for setup, review and editing. Shows no results: Packaging
 * Insights opens only after the inputs are valid and saved.
 */
export function DataEntry() {
  const {
    baseline,
    setBaseline,
    saveScenario,
    mode,
    setupReady,
    reviewed,
    markReviewed,
    completeSetup,
    draft,
    setDraft,
  } = useWorkspace();
  const navigate = useNavigate();
  const { hash } = useLocation();
  const view = !setupReady
    ? "setup"
    : mode === "demo" && !reviewed
      ? "review"
      : "edit";
  const offerOg = mode === "demo";
  // Before setup the built-in example is not the visitor's data: start empty.
  const saved = setupReady ? editable(baseline.input) : blankScenario();
  const input = draft ? editable(draft) : saved;
  const dirty =
    draft !== null && JSON.stringify(input) !== JSON.stringify(saved);
  const [showErrors, setShowErrors] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [importText, setImportText] = useState("");
  const [importUnit, setImportUnit] = useState<"packs" | "kg">("packs");
  const [importMessage, setImportMessage] = useState("");

  // "Edit data & costs" links can jump straight to a section (e.g. #costs).
  useEffect(() => {
    if (hash)
      document
        .getElementById(hash.slice(1))
        ?.scrollIntoView?.({ block: "start" });
  }, [hash]);

  const problems = setupProblems(input);
  const errorFor = (field: string) =>
    showErrors
      ? problems
          .filter((p) => p.field === field)
          .map((p) => p.message)
          .join(" ") || undefined
      : undefined;

  const machine = input.machines[0];
  const change = (next: ScenarioInput) => {
    setDraft(next);
    setSaveError("");
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

  async function submit() {
    if (problems.length > 0) {
      setShowErrors(true);
      document.getElementById(problems[0].field)?.focus();
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const result = await saveScenario(
        {
          id: baseline.id,
          name: setupReady && baseline.name ? baseline.name : "My operation",
          input,
        },
        baseline.id === null,
      );
      setBaseline(result);
      completeSetup(result);
      setDraft(null);
      navigate("/");
    } catch (e) {
      // The draft stays in the form; nothing is unlocked.
      setSaveError(message(e));
    } finally {
      setSaving(false);
    }
  }

  const title =
    view === "setup"
      ? "Enter your data"
      : view === "review"
        ? "Review your saved inputs"
        : "Edit data & costs";
  const saveLabel =
    view === "setup"
      ? "View packaging insights"
      : "Save changes & update insights";

  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">
            {view === "setup" ? "STEP 1 OF 2" : "YOUR DATA"}
          </span>
          <h1>{title}</h1>
          <p>
            {view === "setup"
              ? "Enter your production, pack sizes and costs, then view your Packaging Insights. "
              : view === "review"
                ? "These are the inputs saved in this browser. Check them, then continue to your Packaging Insights. "
                : "Change any value, then save to update your Packaging Insights. "}
            Leave a field empty if you don't know it: results that need it show
            as Unknown, never as zero.
            {offerOg &&
              " To try the demo, click a value marked “OG TOFU” or fill everything at once."}
          </p>
        </div>
      </header>

      {view === "review" && !dirty && (
        <div className="notice review-bar">
          <span>Your saved inputs are below.</span>
          <button
            type="button"
            onClick={() => {
              markReviewed();
              navigate("/");
            }}
          >
            Continue to Packaging Insights →
          </button>
        </div>
      )}

      <div className="data-entry-actions">
        {offerOg && (
          <button
            type="button"
            className="secondary"
            onClick={() => change(ogTofuScenario())}
          >
            Fill everything with OG TOFU data
          </button>
        )}
        <button
          type="button"
          className="secondary"
          onClick={() => change(blankScenario())}
        >
          Clear all fields
        </button>
        {dirty && (
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setDraft(null);
              setShowErrors(false);
            }}
          >
            {setupReady ? "Discard changes" : "Start again"}
          </button>
        )}
      </div>

      <details className="panel import-panel">
        <summary>Import production and pack mix from a spreadsheet</summary>
        <p className="muted">
          Copy your monthly sales from Excel or Google Sheets: month in the
          first column, then one column per pack size with headings such as “1
          kg”, “500 g” or “250 g”. PackPilot uses the latest month for
          production and the last three months for the pack mix.
        </p>
        <label>
          Paste your sales table
          <textarea
            rows={4}
            value={importText}
            placeholder={"Month\t1 kg\t500 g\t250 g\n2026-10\t800\t300\t200"}
            onChange={(e) => setImportText(e.target.value)}
          />
        </label>
        <div className="step-actions">
          <label>
            The numbers are
            <select
              value={importUnit}
              onChange={(e) => setImportUnit(e.target.value as "packs" | "kg")}
            >
              <option value="packs">packs sold</option>
              <option value="kg">kg sold</option>
            </select>
          </label>
          <button
            type="button"
            className="secondary"
            disabled={!importText.trim()}
            onClick={() => {
              const result = importSales(input, importText, importUnit);
              if ("error" in result) setImportMessage(result.error);
              else {
                change(result.input);
                setImportMessage(
                  "Imported into the form below. Check the values, then save.",
                );
              }
            }}
          >
            Apply to the form
          </button>
        </div>
        {importMessage && (
          <p role="status" className="muted">
            {importMessage}
          </p>
        )}
      </details>

      <fieldset className="plain-fieldset" disabled={saving}>
        <section className="panel" id="production">
          <h2>1. Production</h2>
          <Q
            id={fieldIds.production}
            label="How many kilograms do you produce per month?"
            value={input.monthlyProductionKg}
            error={errorFor(fieldIds.production)}
            onChange={(monthlyProductionKg) =>
              change({ ...input, monthlyProductionKg })
            }
            suggestion={offerOg ? og(OG_TOFU.monthlyProductionKg) : undefined}
          />
        </section>

        <section className="panel" id="costs">
          <h2>2. Pack sizes and material costs</h2>
          <p className="muted">
            Add each pack size you sell. The shares say how much of your monthly
            production, by weight, goes into each size, and must add up to 100%.
            Bag and label cost is per pack, in euro.
          </p>
          {input.formats.map((format, index) => (
            <fieldset key={format.id}>
              <legend>Pack size {index + 1}</legend>
              <div className="form-grid">
                <Q
                  id={fieldIds.grams(index)}
                  label={`Pack weight (g) · pack size ${index + 1}`}
                  value={format.portionWeightGrams}
                  error={errorFor(fieldIds.grams(index))}
                  onChange={(portionWeightGrams) =>
                    updateFormat(index, { portionWeightGrams })
                  }
                  suggestion={offerOg ? ogPack(index, "grams") : undefined}
                />
                <Q
                  id={fieldIds.share(index)}
                  label={`Share of production (%) · pack size ${index + 1}`}
                  value={format.allocationPercent}
                  error={errorFor(fieldIds.share(index))}
                  onChange={(allocationPercent) =>
                    updateFormat(index, { allocationPercent })
                  }
                  suggestion={offerOg ? ogPack(index, "share") : undefined}
                />
                {format.materialCost.method === "combined" ? (
                  <Q
                    id={fieldIds.material(index)}
                    label={`Bag and label cost (€ per pack) · pack size ${index + 1}`}
                    value={format.materialCost.combinedEuroPerPackage}
                    error={errorFor(fieldIds.material(index))}
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
                      id={fieldIds.material(index)}
                      label={`Bag cost (€ per pack) · pack size ${index + 1}`}
                      value={format.materialCost.bagEuroPerPackage}
                      error={errorFor(fieldIds.material(index))}
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
          <p
            id={fieldIds.shares}
            tabIndex={-1}
            data-testid="share-total"
            className={
              showErrors && errorFor(fieldIds.shares)
                ? "share-total field-error"
                : "muted share-total"
            }
          >
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
              id={fieldIds.formats}
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

        <section className="panel" id="labour">
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
            <>
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
              <p className="muted">
                With an hourly wage, labour cost comes from the machine times
                and number of operators in section 4.
              </p>
            </>
          )}
        </section>

        <section className="panel" id="equipment">
          <h2>4. Packing equipment</h2>
          <p className="muted">
            Used to estimate packing hours. Leave unknown values empty.
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

        <section className="panel" id="other-costs">
          <h2>5. Other costs (optional)</h2>
          <p className="muted">
            Only costs not already included above. Investment is a one-off
            amount, used only to work out payback when you compare options; it
            is never added to monthly cost.
          </p>
          <div className="form-grid">
            <Q
              label="Machine maintenance (€ per month)"
              value={machine.maintenanceEuroPerMonth}
              onChange={(maintenanceEuroPerMonth) =>
                updateMachine({ maintenanceEuroPerMonth })
              }
            />
            <Q
              label="Other recurring packaging costs (€ per month)"
              value={input.additionalOperatingEuroPerMonth}
              onChange={(additionalOperatingEuroPerMonth) =>
                change({ ...input, additionalOperatingEuroPerMonth })
              }
            />
            <Q
              label="Machine purchase price (€, one-off)"
              value={machine.investmentEuro}
              onChange={(investmentEuro) => updateMachine({ investmentEuro })}
            />
          </div>
        </section>
      </fieldset>

      <section className="panel save-panel">
        {showErrors && problems.length > 0 && (
          <div className="error" role="alert">
            <p>
              Please check{" "}
              {problems.length === 1 ? "this field" : "these fields"}:
            </p>
            <ul>
              {problems.map((p) => (
                <li key={p.field + p.message}>
                  <a
                    href={`#${p.field}`}
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById(p.field)?.focus();
                    }}
                  >
                    {p.message}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        {saveError && (
          <div className="error" role="alert">
            Saving failed: {saveError} Your changes are still in the form.
          </div>
        )}
        <p className="muted">
          {dirty
            ? "You have unsaved changes."
            : setupReady
              ? "No unsaved changes."
              : ""}
          {mode === "demo" &&
            " In the demo, data is stored only in this browser."}
        </p>
        <button
          type="button"
          disabled={saving || (setupReady && !dirty)}
          onClick={() => void submit()}
        >
          {saving ? "Saving…" : saveLabel}
        </button>
      </section>
    </>
  );
}
