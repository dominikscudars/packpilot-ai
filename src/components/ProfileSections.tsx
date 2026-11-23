import { useState } from "react";
import { Link } from "react-router-dom";
import type {
  PackagingCostResult,
  Quantity,
  RecordOf,
  Resources,
  ScenarioInput,
} from "../models/api";
import { assumed, missing } from "../../backend/src/domain/inputs";
import { useWorkspace } from "./WorkspaceProvider";
import { useRequest, RequestState, message } from "./AsyncState";
import { money, decimalText } from "./ApiResults";
import { sizeLabel } from "../onboarding/FormSections";

const n = (q: Quantity) => (q.value === null ? null : Number(q.value));
const show = (q: Quantity, unit: string) =>
  q.value === null ? (
    <span className="not-entered">Not entered</span>
  ) : (
    `${decimalText(q.value, Number(q.value) % 1 ? 2 : 0)} ${unit}`
  );

/** The profile's figures all come from one engine run on the saved data. */
export function OperationProfile({
  input,
  savedAt,
}: {
  input: ScenarioInput;
  savedAt: string | null;
}) {
  const { gateway } = useWorkspace();
  const state = useRequest(JSON.stringify(input), () =>
    gateway.calculate(input),
  );
  if (!state.data)
    return (
      <section className="card section">
        <RequestState
          error={state.error}
          onRetry={state.retry}
          guidance={state.guidance}
          loading={!state.error}
        />
      </section>
    );
  const r = state.data;
  return (
    <>
      <AtAGlance input={input} result={r} savedAt={savedAt} />
      <div className="profile-grid">
        <PackSizes input={input} result={r} />
        <PackingLine input={input} result={r} />
      </div>
      <DataQuality input={input} />
    </>
  );
}

function AtAGlance({
  input,
  result: r,
  savedAt,
}: {
  input: ScenarioInput;
  result: PackagingCostResult;
  savedAt: string | null;
}) {
  const usage = r.machineUsage.find((m) => m.utilizationPercent !== null);
  return (
    <section className="card section" aria-labelledby="at-a-glance">
      <div className="section-head">
        <h2 id="at-a-glance">Operation at a glance</h2>
        <Link to="/data" className="text-link">
          Edit data &amp; costs
        </Link>
      </div>
      <dl className="glance" data-testid="profile-glance">
        <div>
          <dt>Production</dt>
          <dd>{show(input.monthlyProductionKg, "kg / month")}</dd>
        </div>
        <div>
          <dt>Packs</dt>
          <dd>{decimalText(r.totalPackages, 0)} / month</dd>
        </div>
        <div>
          <dt>Packaging cost</dt>
          <dd>{money(r.totalPackagingOperatingEuro)} / month</dd>
        </div>
        <div>
          <dt>Cost per kg</dt>
          <dd>{money(r.packagingEuroPerPlannedKg, 3)}</dd>
        </div>
        <div>
          <dt>Machine time</dt>
          <dd>
            {r.machineHours === null
              ? "Unknown"
              : `${decimalText(r.machineHours, 1)} h / month`}
            {usage?.utilizationPercent &&
              ` · ${Math.round(Number(usage.utilizationPercent))}% used`}
          </dd>
        </div>
        <div>
          <dt>Pack sizes</dt>
          <dd>{input.formats.length}</dd>
        </div>
      </dl>
      {savedAt && (
        <p className="muted small">
          Last saved{" "}
          {new Date(savedAt).toLocaleString("en-GB", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
      )}
    </section>
  );
}

function PackSizes({
  input,
  result: r,
}: {
  input: ScenarioInput;
  result: PackagingCostResult;
}) {
  return (
    <section className="card section" aria-labelledby="pack-sizes">
      <div className="section-head">
        <h2 id="pack-sizes">Products and pack sizes</h2>
        <Link to="/data#costs" className="text-link">
          Edit
        </Link>
      </div>
      <div className="table-scroll">
        <table className="profile-table" data-testid="profile-pack-sizes">
          <thead>
            <tr>
              <th scope="col">Pack</th>
              <th scope="col">Share</th>
              <th scope="col">Packs / month</th>
              <th scope="col">Bag + label</th>
              <th scope="col">€ per kg</th>
            </tr>
          </thead>
          <tbody>
            {input.formats.map((f) => {
              const row = r.rows.find((x) => x.formatId === f.id);
              const c = f.materialCost;
              const material =
                c.method === "combined"
                  ? n(c.combinedEuroPerPackage)
                  : n(c.bagEuroPerPackage) !== null &&
                      n(c.labelEuroPerPackage) !== null
                    ? n(c.bagEuroPerPackage)! + n(c.labelEuroPerPackage)!
                    : null;
              return (
                <tr key={f.id}>
                  <th scope="row">
                    {sizeLabel(f.portionWeightGrams.value) ?? "?"}
                  </th>
                  <td>{f.allocationPercent.value ?? "?"}%</td>
                  <td>{row ? decimalText(row.packages, 0) : "—"}</td>
                  <td>
                    {material === null ? "Unknown" : money(String(material), 3)}
                  </td>
                  <td>{row ? money(row.packagingEuroPerPackedKg, 3) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PackingLine({
  input,
  result: r,
}: {
  input: ScenarioInput;
  result: PackagingCostResult;
}) {
  const m = input.machines[0];
  const cycle = m?.throughput.method === "cycle" ? m.throughput : null;
  const perHour =
    cycle && n(cycle.cycleSeconds) && n(cycle.packagesPerCycle)
      ? Math.round((3600 / n(cycle.cycleSeconds)!) * n(cycle.packagesPerCycle)!)
      : null;
  const usage = r.machineUsage.find((u) => u.utilizationPercent !== null);
  return (
    <section className="card section" aria-labelledby="packing-line">
      <div className="section-head">
        <h2 id="packing-line">Packing line</h2>
        <Link to="/data#equipment" className="text-link">
          Edit
        </Link>
      </div>
      <dl className="facts" data-testid="profile-packing-line">
        <div>
          <dt>Speed</dt>
          <dd>
            {cycle ? (
              <>
                {show(cycle.packagesPerCycle, "packs")} every{" "}
                {show(cycle.cycleSeconds, "s")}
                {perHour !== null && ` · about ${perHour} packs / hour`}
              </>
            ) : (
              <span className="not-entered">Not entered</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Operators</dt>
          <dd>{m ? show(m.operators, "") : "—"}</dd>
        </div>
        <div>
          <dt>Available time</dt>
          <dd>
            {m ? show(m.availableHoursPerMonth, "h / month") : "—"}
            {usage?.utilizationPercent &&
              ` · ${Math.round(Number(usage.utilizationPercent))}% used`}
          </dd>
        </div>
        <div>
          <dt>Maintenance</dt>
          <dd>{m ? show(m.maintenanceEuroPerMonth, "€ / month") : "—"}</dd>
        </div>
        <div>
          <dt>Labour</dt>
          <dd>
            {input.labor.method === "perPackage"
              ? show(input.labor.euroPerPackage, "€ per pack")
              : show(input.labor.euroPerPersonHour, "€ per hour")}
          </dd>
        </div>
      </dl>
    </section>
  );
}

interface Field {
  label: string;
  q: Quantity;
  section: string;
}
function fields(input: ScenarioInput): Field[] {
  const out: Field[] = [
    {
      label: "Monthly production",
      q: input.monthlyProductionKg,
      section: "production",
    },
  ];
  input.formats.forEach((f, i) => {
    const name = sizeLabel(f.portionWeightGrams.value) ?? `Pack size ${i + 1}`;
    out.push({
      label: `${name} weight`,
      q: f.portionWeightGrams,
      section: "production",
    });
    out.push({
      label: `${name} share of production`,
      q: f.allocationPercent,
      section: "production",
    });
    const c = f.materialCost;
    if (c.method === "combined")
      out.push({
        label: `${name} bag and label cost`,
        q: c.combinedEuroPerPackage,
        section: "costs",
      });
    else {
      out.push({
        label: `${name} bag cost`,
        q: c.bagEuroPerPackage,
        section: "costs",
      });
      out.push({
        label: `${name} label cost`,
        q: c.labelEuroPerPackage,
        section: "costs",
      });
    }
  });
  out.push({
    label: "Labour",
    q:
      input.labor.method === "perPackage"
        ? input.labor.euroPerPackage
        : input.labor.euroPerPersonHour,
    section: "labour",
  });
  const m = input.machines[0];
  if (m) {
    if (m.throughput.method === "cycle") {
      out.push({
        label: "Machine cycle time",
        q: m.throughput.cycleSeconds,
        section: "equipment",
      });
      out.push({
        label: "Packs per cycle",
        q: m.throughput.packagesPerCycle,
        section: "equipment",
      });
    }
    out.push({
      label: "Machine operators",
      q: m.operators,
      section: "equipment",
    });
    out.push({
      label: "Available machine hours",
      q: m.availableHoursPerMonth,
      section: "equipment",
    });
    out.push({
      label: "Machine maintenance",
      q: m.maintenanceEuroPerMonth,
      section: "other-costs",
    });
  }
  out.push({
    label: "Other recurring costs",
    q: input.additionalOperatingEuroPerMonth,
    section: "other-costs",
  });
  return out;
}

/** Which numbers are reported, which are estimates, and which are missing. */
function DataQuality({ input }: { input: ScenarioInput }) {
  const all = fields(input);
  const reported = all.filter(
    (f) => f.q.quality === "reported" || f.q.quality === "verified",
  );
  const estimates = all.filter((f) => f.q.quality === "assumption");
  const missingFields = all.filter((f) => f.q.quality === "missing");
  return (
    <section className="card section" aria-labelledby="data-quality">
      <div className="section-head">
        <h2 id="data-quality">Data quality</h2>
      </div>
      <div className="quality-bar" aria-hidden="true">
        <span className="q-reported" style={{ flexGrow: reported.length }} />
        <span className="q-estimate" style={{ flexGrow: estimates.length }} />
        <span
          className="q-missing"
          style={{ flexGrow: missingFields.length }}
        />
      </div>
      <ul className="quality-legend" data-testid="data-quality">
        <li>
          <span className="swatch q-reported" aria-hidden="true" />
          <strong>{reported.length}</strong> reported by the company
        </li>
        <li>
          <span className="swatch q-estimate" aria-hidden="true" />
          <strong>{estimates.length}</strong> entered or estimated
        </li>
        <li>
          <span className="swatch q-missing" aria-hidden="true" />
          <strong>{missingFields.length}</strong> not entered
        </li>
      </ul>
      {(estimates.length > 0 || missingFields.length > 0) && (
        <details className="quality-details">
          <summary>Show estimates and missing numbers</summary>
          <ul>
            {[...missingFields, ...estimates].map((f) => (
              <li key={f.label}>
                <Link to={`/data#${f.section}`}>{f.label}</Link>
                <span className="muted">
                  {" "}
                  —{" "}
                  {f.q.quality === "missing"
                    ? "not entered"
                    : (f.q.sourceNote ?? "your entry")}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

type Supplier = RecordOf<Resources["suppliers"]>;
const count = (v: string, note: string): Quantity =>
  v.trim() ? assumed(String(Math.round(Number(v))), note) : missing();
const NOTE = "Entered on the company profile.";

/** Who supplies the packaging, with lead time and minimum order. */
export function Suppliers() {
  const { catalog, addRecord, saveRecord } = useWorkspace();
  const [editing, setEditing] = useState<Supplier | "new" | null>(null);
  return (
    <section className="card section" aria-labelledby="suppliers">
      <div className="section-head">
        <h2 id="suppliers">Suppliers</h2>
        {editing === null && (
          <button
            type="button"
            className="secondary"
            onClick={() => setEditing("new")}
          >
            + Add supplier
          </button>
        )}
      </div>
      {catalog.suppliers.length === 0 && editing === null && (
        <p className="muted">
          Add who supplies your bags and labels, with lead time and minimum
          order, so you have them at hand when you compare prices.
        </p>
      )}
      {catalog.suppliers.length > 0 && (
        <ul className="supplier-list" data-testid="supplier-list">
          {catalog.suppliers.map((s) => (
            <li key={s.id}>
              <div>
                <strong>{s.name}</strong>
                {s.quotations && (
                  <span className="muted"> · {s.quotations}</span>
                )}
                <div className="supplier-facts">
                  {s.leadTimeCalendarDays.value !== null && (
                    <span>{s.leadTimeCalendarDays.value} days delivery</span>
                  )}
                  {s.minimumOrderPackages.value !== null && (
                    <span>
                      min.{" "}
                      {Number(s.minimumOrderPackages.value).toLocaleString(
                        "en-US",
                      )}{" "}
                      packs
                    </span>
                  )}
                  {s.contactInformation && <span>{s.contactInformation}</span>}
                </div>
              </div>
              {editing === null && (
                <button
                  type="button"
                  className="ghost"
                  aria-label={`Edit ${s.name}`}
                  onClick={() => setEditing(s)}
                >
                  Edit
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {editing !== null && (
        <SupplierForm
          record={editing === "new" ? null : editing}
          onCancel={() => setEditing(null)}
          onSave={async (value) => {
            if (editing === "new") await addRecord("suppliers", value);
            else await saveRecord("suppliers", editing, value);
            setEditing(null);
          }}
        />
      )}
    </section>
  );
}

function SupplierForm({
  record,
  onSave,
  onCancel,
}: {
  record: Supplier | null;
  onSave: (value: Resources["suppliers"]) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(record?.name ?? "");
  const [supplies, setSupplies] = useState(record?.quotations ?? "");
  const [contact, setContact] = useState(record?.contactInformation ?? "");
  const [lead, setLead] = useState(record?.leadTimeCalendarDays.value ?? "");
  const [moq, setMoq] = useState(record?.minimumOrderPackages.value ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const whole = (v: string) => v.trim() === "" || /^\d+$/.test(v.trim());
  return (
    <form
      className="supplier-form"
      aria-label={record ? `Edit ${record.name}` : "New supplier"}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return setError("Enter the supplier's name.");
        if (!whole(lead) || !whole(moq))
          return setError(
            "Delivery time and minimum order must be whole numbers.",
          );
        setBusy(true);
        setError("");
        try {
          await onSave({
            name: name.trim(),
            quotations: supplies.trim() || null,
            contactInformation: contact.trim() || null,
            leadTimeCalendarDays: count(lead, NOTE),
            minimumOrderPackages: count(moq, NOTE),
          });
        } catch (err) {
          setError(message(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset className="plain-fieldset" disabled={busy}>
        <div className="form-grid">
          <label>
            Supplier name
            <input
              value={name}
              maxLength={200}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            What they supply
            <input
              value={supplies}
              maxLength={500}
              placeholder="e.g. PA/PE vacuum bags, €0.06 per pack"
              onChange={(e) => setSupplies(e.target.value)}
            />
          </label>
          <label>
            Delivery time (days)
            <input
              inputMode="numeric"
              value={lead}
              onChange={(e) => setLead(e.target.value)}
            />
          </label>
          <label>
            Minimum order (packs)
            <input
              inputMode="numeric"
              value={moq}
              onChange={(e) => setMoq(e.target.value)}
            />
          </label>
          <label>
            Contact
            <input
              value={contact}
              maxLength={500}
              placeholder="Name, email or phone"
              onChange={(e) => setContact(e.target.value)}
            />
          </label>
        </div>
        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}
        <div className="chat-actions">
          <button type="submit">{busy ? "Saving…" : "Save supplier"}</button>
          <button type="button" className="ghost" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </fieldset>
    </form>
  );
}
