import { useState } from "react";
import { Link } from "react-router-dom";
import type { ScenarioInput } from "../models/api";
import { useWorkspace } from "./WorkspaceProvider";
import { useRequest, RequestState } from "./AsyncState";
import { money, decimalText } from "./ApiResults";
import { normalizeDecimal } from "./QuantityField";
import {
  compareQuotes,
  type SupplierQuote,
} from "../calculations/supplierQuotes";
import { EXAMPLE_QUOTES } from "../demo/supplierQuotes";

type Draft = Record<keyof SupplierQuote, string>;
const blank = (): Draft => ({
  name: "",
  euroPerPackage: "",
  minimumOrderPackages: "",
  leadTimeDays: "",
  setupFeeEuro: "",
});
const FIELDS: {
  key: keyof Draft;
  label: string;
  what: string;
  optional?: boolean;
}[] = [
  { key: "name", label: "Supplier name", what: "name" },
  {
    key: "euroPerPackage",
    label: "Bag and label price (€ per pack)",
    what: "price per pack",
  },
  {
    key: "minimumOrderPackages",
    label: "Minimum order (packs)",
    what: "minimum order",
  },
  { key: "leadTimeDays", label: "Lead time (days)", what: "lead time" },
  {
    key: "setupFeeEuro",
    label: "Setup or plate fee (€, optional)",
    what: "setup fee",
    optional: true,
  },
];
const num = (v: string) => /^\d+(\.\d+)?$/.test(normalizeDecimal(v.trim()));

/** A complete quote, or the plain-English reason it cannot be compared yet. */
function parse(d: Draft, i: number): SupplierQuote | string {
  const label = d.name.trim() || `Supplier ${i + 1}`;
  if (!d.name.trim()) return `${label}: enter the supplier name.`;
  for (const f of FIELDS.slice(1)) {
    const v = d[f.key].trim();
    if (!num(v) && !(f.optional && !v))
      return `${label}: enter the ${f.what} as a number, 0 or more.`;
  }
  const n = (v: string) => normalizeDecimal(v.trim());
  return {
    name: d.name.trim(),
    euroPerPackage: n(d.euroPerPackage),
    minimumOrderPackages: n(d.minimumOrderPackages),
    leadTimeDays: n(d.leadTimeDays),
    setupFeeEuro: d.setupFeeEuro.trim() ? n(d.setupFeeEuro) : null,
  };
}

/** Compare 2–3 packaging material quotes against the saved material cost. */
export function SupplierQuotes({ input }: { input: ScenarioInput }) {
  const [drafts, setDrafts] = useState<Draft[]>([blank(), blank()]);
  const set = (i: number, key: keyof Draft, value: string) =>
    setDrafts((all) =>
      all.map((d, j) => (j === i ? { ...d, [key]: value } : d)),
    );
  const ready =
    input.monthlyProductionKg.value !== null && input.formats.length > 0;
  // Untouched columns are ignored rather than reported as incomplete.
  const parsed = drafts
    .map((d, i) =>
      Object.values(d).some((v) => v.trim()) ? parse(d, i) : null,
    )
    .filter((p) => p !== null);
  const problems = parsed.filter((p): p is string => typeof p === "string");
  const quotes = parsed.filter(
    (p): p is SupplierQuote => typeof p !== "string",
  );
  return (
    <section
      className="panel test-change supplier-quotes"
      aria-label="Compare supplier quotes"
    >
      <h2>Compare supplier quotes</h2>
      <p className="muted">
        Enter 2–3 quotes for bags and labels. Each price is applied to every
        pack you use per month; labour and machine costs stay the same. Your
        saved data is not changed.
      </p>
      <button
        type="button"
        className="secondary"
        onClick={() => setDrafts(EXAMPLE_QUOTES.map((q) => ({ ...q })))}
      >
        Load example supplier quotes
      </button>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">Quote</th>
              {drafts.map((_, i) => (
                <th scope="col" key={i}>
                  Supplier {i + 1}
                  {drafts.length > 2 && (
                    <>
                      {" · "}
                      <button
                        type="button"
                        className="link-button"
                        onClick={() =>
                          setDrafts((all) => all.filter((_, j) => j !== i))
                        }
                      >
                        Remove supplier {i + 1}
                      </button>
                    </>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FIELDS.map((f) => (
              <tr key={f.key}>
                <th scope="row">{f.label}</th>
                {drafts.map((d, i) => (
                  <td key={i}>
                    <input
                      aria-label={`${f.label} · supplier ${i + 1}`}
                      inputMode={f.key === "name" ? "text" : "decimal"}
                      value={d[f.key]}
                      onChange={(e) => set(i, f.key, e.target.value)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {drafts.length < 3 && (
        <button
          type="button"
          className="secondary"
          onClick={() => setDrafts((all) => [...all, blank()])}
        >
          + Add a supplier
        </button>
      )}
      {ready &&
        problems.map((p) => (
          <p key={p} className="notice">
            {p}
          </p>
        ))}
      {!ready ? (
        <p className="notice" data-testid="quotes-missing">
          To compare quotes, first enter your{" "}
          {input.monthlyProductionKg.value === null &&
          input.formats.length === 0
            ? "monthly production and pack sizes"
            : input.monthlyProductionKg.value === null
              ? "monthly production"
              : "pack sizes"}{" "}
          in <Link to="/data#production">Edit data & costs</Link>. PackPilot
          needs them to know how many packs you use each month.
        </p>
      ) : (
        quotes.length > 0 && <Results input={input} quotes={quotes} />
      )}
    </section>
  );
}

function Results({
  input,
  quotes,
}: {
  input: ScenarioInput;
  quotes: SupplierQuote[];
}) {
  const { gateway } = useWorkspace();
  const state = useRequest(JSON.stringify(input), () =>
    gateway.calculate(input),
  );
  if (!state.data)
    return (
      <RequestState
        error={state.error}
        onRetry={state.retry}
        guidance={state.guidance}
        loading={!state.error}
      />
    );
  const r = state.data;
  const c = compareQuotes(r, quotes);
  const signed = (v: string) =>
    `${Number(v) > 0 ? "+" : Number(v) < 0 ? "−" : "±"}${money(String(Math.abs(Number(v))))}`;
  return (
    <>
      <div className="table-scroll" data-testid="quote-comparison">
        <table>
          <caption className="muted">
            Material cost for your {decimalText(r.totalPackages, 0)} packs and{" "}
            {decimalText(r.monthlyProductionKg, 0)} kg a month.
          </caption>
          <thead>
            <tr>
              <th scope="col" />
              <th scope="col">Current</th>
              {c.quotes.map((q, i) => (
                <th scope="col" key={i}>
                  {q.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Material cost per month</th>
              <td>{money(r.totalMaterialEuro)}</td>
              {c.quotes.map((q, i) => (
                <td key={i}>{money(q.monthlyMaterialEuro)}</td>
              ))}
            </tr>
            <tr>
              <th scope="row">Material cost per kg</th>
              <td>{money(c.currentMaterialEuroPerKg, 3)}</td>
              {c.quotes.map((q, i) => (
                <td key={i}>{money(q.materialEuroPerKg, 3)}</td>
              ))}
            </tr>
            <tr>
              <th scope="row">Saving (−) or increase (+) per month</th>
              <td>—</td>
              {c.quotes.map((q, i) => (
                <td key={i}>
                  {q.differenceEuroPerMonth === null
                    ? "Unknown"
                    : signed(q.differenceEuroPerMonth)}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Minimum order</th>
              <td>—</td>
              {c.quotes.map((q, i) => (
                <td key={i}>
                  {decimalText(q.minimumOrderPackages, 0)} packs
                  {q.minimumOrderMonths !== null &&
                    ` · ${q.minimumOrderMonths} months of use`}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Cash for first order</th>
              <td>—</td>
              {c.quotes.map((q, i) => (
                <td key={i}>{money(q.firstOrderEuro)}</td>
              ))}
            </tr>
            <tr>
              <th scope="row">Lead time</th>
              <td>—</td>
              {c.quotes.map((q, i) => (
                <td key={i}>{decimalText(q.leadTimeDays, 0)} days</td>
              ))}
            </tr>
            <tr>
              <th scope="row">Setup or plate fee</th>
              <td>—</td>
              {c.quotes.map((q, i) => (
                <td key={i}>
                  {q.setupFeeEuro === null ? "None" : money(q.setupFeeEuro)}
                  {q.setupPaybackMonths !== null &&
                    ` · recovered in ${q.setupPaybackMonths} months`}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      {r.totalMaterialEuro === null && (
        <p className="notice" data-testid="quotes-no-baseline">
          Savings are Unknown until every pack size has a bag and label cost.
          Add it in <Link to="/data#costs">Edit data & costs</Link>.
        </p>
      )}
      <p className="footnote">
        Material only, before VAT and delivery. Quotes are as you entered them;
        PackPilot does not check suppliers, specifications or food-contact
        compliance.
      </p>
    </>
  );
}
