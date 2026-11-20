import type { ScenarioInput } from "../models/api";
import { missing } from "../../backend/src/domain/inputs";
import { QuantityField as Q } from "../components/QuantityField";
import { fieldIds } from "../setup/setupState";
import {
  MAX_FORMATS,
  blankFormat,
  newId,
  shareTotal,
  type Format,
  type Machine,
} from "./scenarioForm";

export interface SectionProps {
  input: ScenarioInput;
  change: (next: ScenarioInput) => void;
  /** Validation message for a field, if it should be shown now. */
  errorFor: (field: string) => string | undefined;
}

export const sizeLabel = (grams: string | null) => {
  const g = Number(grams);
  if (!grams || !Number.isFinite(g) || g <= 0) return null;
  return g >= 1000 && g % 1000 === 0 ? `${g / 1000} kg` : `${g} g`;
};

function updateFormat(
  { input, change }: SectionProps,
  index: number,
  patch: Partial<Format>,
) {
  change({
    ...input,
    formats: input.formats.map((f, i) =>
      i === index ? { ...f, ...patch } : f,
    ),
  });
}

function updateMachine(
  { input, change }: SectionProps,
  patch: Partial<Machine>,
) {
  change({
    ...input,
    machines: input.machines.map((m, i) => (i === 0 ? { ...m, ...patch } : m)),
  });
}

/** Step 1: monthly production and the pack sizes it goes into. */
export function ProductionSection(props: SectionProps) {
  const { input, change, errorFor } = props;
  const total = shareTotal(input.formats);
  const sharesError = errorFor(fieldIds.shares);
  return (
    <div className="form-section" id="production">
      <Q
        id={fieldIds.production}
        label="How many kilograms do you produce per month?"
        hint="Total kilograms packed in a normal month."
        value={input.monthlyProductionKg}
        error={errorFor(fieldIds.production)}
        onChange={(monthlyProductionKg) =>
          change({ ...input, monthlyProductionKg })
        }
      />
      <div className="subsection-head">
        <h3>Pack sizes</h3>
        <p>Share = % of your monthly kilograms in each size. Total 100%.</p>
      </div>
      <div className="pack-list">
        {input.formats.map((format, index) => (
          <fieldset className="pack-row" key={format.id}>
            <legend>Pack size {index + 1}</legend>
            <Q
              id={fieldIds.grams(index)}
              label={`Pack weight (g) · pack size ${index + 1}`}

              value={format.portionWeightGrams}
              error={errorFor(fieldIds.grams(index))}
              onChange={(portionWeightGrams) =>
                updateFormat(props, index, { portionWeightGrams })
              }
            />
            <Q
              id={fieldIds.share(index)}
              label={`Share of production (%) · pack size ${index + 1}`}

              value={format.allocationPercent}
              error={errorFor(fieldIds.share(index))}
              onChange={(allocationPercent) =>
                updateFormat(props, index, { allocationPercent })
              }
            />
            {input.formats.length > 1 && (
              <button
                type="button"
                className="ghost remove-pack"
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
      </div>
      <div className="pack-footer">
        <p
          id={fieldIds.shares}
          tabIndex={-1}
          data-testid="share-total"
          className={`share-total${
            sharesError ? " field-error" : total?.eq(100) ? " share-ok" : ""
          }`}
        >
          {total === null
            ? "Enter a share for every pack size."
            : total.eq(100)
              ? "✓ Shares add up to 100%."
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
                    input.machines[0]?.id ?? "machine-1",
                  ),
                ],
              })
            }
          >
            + Add pack size
          </button>
        )}
      </div>
    </div>
  );
}

/** Step 2: bag and label cost for each pack size. */
export function MaterialsSection(props: SectionProps) {
  const { input, errorFor } = props;
  return (
    <div className="form-section" id="costs">
      <p className="section-intro">Bag plus label, per pack, in euro.</p>
      {input.formats.map((format, index) => {
        const name = sizeLabel(format.portionWeightGrams.value);
        const cost = format.materialCost;
        const separate = cost.method === "itemized";
        return (
          <fieldset className="material-row" key={format.id}>
            <legend>
              Pack size {index + 1}
              {name && <span className="legend-tag">{name}</span>}
            </legend>
            {cost.method === "combined" ? (
              <Q
                id={fieldIds.material(index)}
                label={`Bag and label cost (€ per pack) · pack size ${index + 1}`}

                value={cost.combinedEuroPerPackage}
                error={errorFor(fieldIds.material(index))}
                onChange={(combinedEuroPerPackage) =>
                  updateFormat(props, index, {
                    materialCost: {
                      method: "combined",
                      combinedEuroPerPackage,
                    },
                  })
                }
              />
            ) : (
              <div className="form-grid">
                <Q
                  id={fieldIds.material(index)}
                  label={`Bag cost (€ per pack) · pack size ${index + 1}`}
                  value={cost.bagEuroPerPackage}
                  error={errorFor(fieldIds.material(index))}
                  onChange={(bagEuroPerPackage) =>
                    updateFormat(props, index, {
                      materialCost: { ...cost, bagEuroPerPackage },
                    })
                  }
                />
                <Q
                  label={`Label cost (€ per pack) · pack size ${index + 1}`}
                  value={cost.labelEuroPerPackage}
                  onChange={(labelEuroPerPackage) =>
                    updateFormat(props, index, {
                      materialCost: { ...cost, labelEuroPerPackage },
                    })
                  }
                />
              </div>
            )}
            <label className="check-option">
              <input
                type="checkbox"
                checked={separate}
                onChange={() =>
                  updateFormat(props, index, {
                    materialCost: separate
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
              />
              I know the bag and label prices separately
            </label>
          </fieldset>
        );
      })}
    </div>
  );
}

/** Step 3: packing labour, machine capacity and other recurring costs. */
export function LabourSection(props: SectionProps) {
  const { input, change } = props;
  const machine = input.machines[0];
  const cycle =
    machine.throughput.method === "cycle"
      ? machine.throughput
      : {
          method: "cycle" as const,
          packagesPerCycle: missing(),
          cycleSeconds: missing(),
        };
  return (
    <>
      <div className="form-section" id="labour">
        <h3>Packing labour</h3>
        <fieldset className="choice-group">
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
            <span>
              <strong>Per pack</strong>
              <small>e.g. €0.15 of labour for each pack</small>
            </span>
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
            <span>
              <strong>Hourly wage</strong>
              <small>worked out from machine time and operators</small>
            </span>
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
          />
        ) : (
          <Q
            label="Hourly wage including taxes (€ per hour)"
            hint="Including employer taxes."
            value={input.labor.euroPerPersonHour}
            onChange={(euroPerPersonHour) =>
              change({
                ...input,
                labor: { method: "hourly", euroPerPersonHour },
              })
            }
          />
        )}
      </div>
      <div className="form-section" id="equipment">
        <h3>Packing machine & capacity</h3>

        <div className="form-grid">
          <Q
            label="Seconds per machine cycle"
            hint="Time one cycle with a stopwatch."
            value={cycle.cycleSeconds}
            onChange={(cycleSeconds) =>
              updateMachine(props, { throughput: { ...cycle, cycleSeconds } })
            }
          />
          <Q
            label="Packs sealed per cycle"

            value={cycle.packagesPerCycle}
            onChange={(packagesPerCycle) =>
              updateMachine(props, {
                throughput: { ...cycle, packagesPerCycle },
              })
            }
          />
          <Q
            label="People operating the machine"

            value={machine.operators}
            onChange={(operators) => updateMachine(props, { operators })}
          />
          <Q
            label="Hours the machine is available per month"
            hint="e.g. 4 h × 21 days = 84"
            value={machine.availableHoursPerMonth}
            onChange={(availableHoursPerMonth) =>
              updateMachine(props, { availableHoursPerMonth })
            }
          />
        </div>
      </div>
      <div className="form-section" id="other-costs">
        <h3>Other costs (optional)</h3>

        <div className="form-grid">
          <Q
            label="Machine maintenance (€ per month)"
            hint="0 if none"
            value={machine.maintenanceEuroPerMonth}
            onChange={(maintenanceEuroPerMonth) =>
              updateMachine(props, { maintenanceEuroPerMonth })
            }
          />
          <Q
            label="Other recurring packaging costs (€ per month)"
            hint="Boxes, tape, cleaning. 0 if none"
            value={input.additionalOperatingEuroPerMonth}
            onChange={(additionalOperatingEuroPerMonth) =>
              change({ ...input, additionalOperatingEuroPerMonth })
            }
          />
          <Q
            label="Machine purchase price (€, one-off)"
            value={machine.investmentEuro}
            onChange={(investmentEuro) =>
              updateMachine(props, { investmentEuro })
            }
          />
        </div>
      </div>
    </>
  );
}

/** Read-only summary of the inputs, with links back to each step. */
export function InputReview({
  input,
  onEdit,
}: {
  input: ScenarioInput;
  onEdit: (step: number) => void;
}) {
  const eur = (value: string | null, unit: string) =>
    value === null ? (
      <span className="not-entered">Not entered</span>
    ) : (
      `€${value} ${unit}`
    );
  const v = (value: string | null, unit: string) =>
    value === null ? (
      <span className="not-entered">Not entered</span>
    ) : (
      `${value} ${unit}`
    );
  const machine = input.machines[0];
  const cycle =
    machine?.throughput.method === "cycle" ? machine.throughput : null;
  const groups: {
    step: number;
    title: string;
    rows: [string, React.ReactNode][];
  }[] = [
    {
      step: 0,
      title: "Production",
      rows: [
        ["Monthly production", v(input.monthlyProductionKg.value, "kg")],
        ...input.formats.map((f, i): [string, React.ReactNode] => [
          `Pack size ${i + 1}`,
          `${sizeLabel(f.portionWeightGrams.value) ?? "?"} · ${f.allocationPercent.value ?? "?"}% of production`,
        ]),
      ],
    },
    {
      step: 1,
      title: "Packaging materials",
      rows: input.formats.map((f, i): [string, React.ReactNode] => {
        const c = f.materialCost;
        return [
          `${sizeLabel(f.portionWeightGrams.value) ?? `Pack size ${i + 1}`} packaging`,
          c.method === "combined"
            ? eur(c.combinedEuroPerPackage.value, "per pack")
            : c.bagEuroPerPackage.value === null ||
                c.labelEuroPerPackage.value === null
              ? v(null, "")
              : `€${c.bagEuroPerPackage.value} bag + €${c.labelEuroPerPackage.value} label`,
        ];
      }),
    },
    {
      step: 2,
      title: "Labour & capacity",
      rows: [
        [
          "Labour",
          input.labor.method === "perPackage"
            ? eur(input.labor.euroPerPackage.value, "per pack")
            : eur(input.labor.euroPerPersonHour.value, "per hour"),
        ],
        ["Machine cycle", v(cycle?.cycleSeconds.value ?? null, "seconds")],
        ["Packs per cycle", v(cycle?.packagesPerCycle.value ?? null, "packs")],
        [
          "Operators",
          v(
            machine?.operators.value ?? null,
            machine?.operators.value === "1" ? "person" : "people",
          ),
        ],
        [
          "Available machine hours",
          v(machine?.availableHoursPerMonth.value ?? null, "h per month"),
        ],
      ],
    },
  ];
  return (
    <div className="review-grid">
      {groups.map((g) => (
        <section className="review-card" key={g.title} aria-label={g.title}>
          <div className="review-card-head">
            <h3>{g.title}</h3>
            <button
              type="button"
              className="link-button"
              aria-label={`Edit ${g.title}`}
              onClick={() => onEdit(g.step)}
            >
              Edit
            </button>
          </div>
          <dl>
            {g.rows.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
