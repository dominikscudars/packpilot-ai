import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Decimal } from "decimal.js";
import type { InventoryResult, Quantity } from "../models/api";
import { assumed, missing } from "../../backend/src/domain/inputs";
import { useWorkspace } from "../components/WorkspaceProvider";
import { useRequest, RequestState } from "../components/AsyncState";
import { QuantityField as Q } from "../components/QuantityField";
import { decimalText } from "../components/ApiResults";
import { DataSummary } from "../components/DataSummary";
import { DEMO_REFERENCE_NAME } from "../demo/apiDemo";

/** One packaging item whose monthly use follows from the step 1 data. */
interface Item {
  id: string;
  name: string;
  monthlyUse: number | null;
}

const LEAD_CHOICES = [7, 14, 21];
const STORE_KEY = "packpilot.reorder.v1";
const note = "Entered on the reorder page; not independently verified.";
const entered = (value: number) => assumed(String(value), note);

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
function daysInMonth(iso: string): number {
  const [y, m] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
function formatDate(iso: string | null): string {
  if (!iso) return "unknown date";
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
const count = (n: number | string | null) =>
  n === null ? "?" : decimalText(n, 0);

interface Saved {
  stock: Record<string, string>;
  moq: Record<string, string>;
  lead: string;
  boxKg: string;
}
function load(): Saved | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}
function save(value: Saved) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(value));
  } catch {
    // Browser storage is a convenience only; the page works without it.
  }
}
const asQuantity = (v: string | undefined): Quantity =>
  v ? assumed(v, note) : missing();

type Status = "now" | "soon" | "ok" | "unknown";
const STATUS_TEXT: Record<Status, string> = {
  now: "Order now",
  soon: "Order this week",
  ok: "OK for now",
  unknown: "Need stock count",
};

/** Step 3: when to reorder bags, labels and boxes, from step 1 data. */
export function Reorder() {
  const { baseline, gateway, mode } = useWorkspace();
  const saved = mode === "demo" ? load() : null;
  const [stock, setStock] = useState<Record<string, string>>(
    saved?.stock ?? {},
  );
  const [moq, setMoq] = useState<Record<string, string>>(saved?.moq ?? {});
  const [lead, setLead] = useState(saved?.lead ?? "14");
  const [boxKg, setBoxKg] = useState(saved?.boxKg ?? "");
  const [bufferWeeks, setBufferWeeks] = useState(1);
  const [orderDays, setOrderDays] = useState(30);
  const [copied, setCopied] = useState(false);

  const costs = useRequest(JSON.stringify(baseline.input), () =>
    gateway.calculate(baseline.input),
  );
  const asOf = today();
  const monthDays = daysInMonth(asOf);

  const items: Item[] = [];
  if (costs.data) {
    for (const row of costs.data.rows) {
      const format = baseline.input.formats.find((f) => f.id === row.formatId);
      const grams = format?.portionWeightGrams.value;
      items.push({
        id: `bag-${row.formatId}`,
        name: `${grams ?? "?"} g bags`,
        monthlyUse: row.packages,
      });
    }
    items.push({
      id: "labels",
      name: "Labels",
      monthlyUse: costs.data.totalPackages,
    });
    const kg = Number(costs.data.packedProductionKg);
    const perBox = Number(boxKg);
    items.push({
      id: "boxes",
      name: "Transport boxes",
      monthlyUse:
        boxKg && perBox > 0
          ? new Decimal(kg).div(perBox).ceil().toNumber()
          : null,
    });
  }

  const plans = useRequest(
    JSON.stringify([items, stock, moq, lead, bufferWeeks, orderDays, asOf]),
    async () =>
      Promise.all(
        items.map(async (item) => {
          if (item.monthlyUse === null || !stock[item.id]) return null;
          const daily = item.monthlyUse / monthDays;
          return gateway.inventory({
            currentStockPackages: entered(Number(stock[item.id])),
            expectedMonthlyConsumptionPackages: assumed(
              String(item.monthlyUse),
              "Calculated from step 1: production and pack mix.",
            ),
            calendarDaysInPlanningMonth: assumed(
              String(monthDays),
              "Days in the current month.",
            ),
            workingDaysInPlanningMonth: assumed(
              String(monthDays),
              "Descriptive only; calendar days drive the plan.",
            ),
            leadTimeCalendarDays: asQuantity(lead),
            minimumOrderPackages: moq[item.id]
              ? asQuantity(moq[item.id])
              : assumed("0", "No minimum order entered."),
            safetyStockPackages: assumed(
              String(Math.ceil(daily * 7 * bufferWeeks)),
              `Safety buffer of ${bufferWeeks} week(s) of use.`,
            ),
            reviewPeriodCalendarDays: assumed(
              String(orderDays),
              "Each order should last about this many days.",
            ),
            asOfDate: asOf,
            outstandingPurchaseOrders: [],
          });
        }),
      ),
  );

  if (mode === "demo" && baseline.name === DEMO_REFERENCE_NAME)
    return <Navigate to="/data" replace />;

  const remember = (next: Partial<Saved>) => {
    setCopied(false);
    if (mode === "demo") save({ stock, moq, lead, boxKg, ...next });
  };

  const rows = items.map((item, i) => {
    const plan: InventoryResult | null = plans.data?.[i] ?? null;
    let status: Status = "unknown";
    if (plan?.estimatedReorderDate) {
      const daysLeft =
        (Date.parse(plan.estimatedReorderDate) - Date.parse(asOf)) / 86_400_000;
      status = daysLeft <= 0 ? "now" : daysLeft <= 7 ? "soon" : "ok";
    }
    // Quantity to order when the reorder date comes: the engine's suggestion
    // if an order is due now, otherwise about one order period of use.
    const quantity =
      plan === null || item.monthlyUse === null
        ? null
        : status === "now"
          ? Number(plan.suggestedOrderPackages)
          : Math.max(
              Math.ceil((item.monthlyUse / monthDays) * orderDays),
              Number(moq[item.id] || 0),
            );
    return { item, plan, status, quantity };
  });
  const order: Record<Status, number> = { now: 0, soon: 1, ok: 2, unknown: 3 };
  const sorted = [...rows].sort((a, b) => order[a.status] - order[b.status]);
  const orderList = sorted
    .filter((r) => r.status === "now" || r.status === "soon")
    .map(
      (r) =>
        `- ${r.item.name}: ${count(r.quantity)} (order by ${formatDate(r.plan?.estimatedReorderDate ?? null)})`,
    );

  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">TOOL</span>
          <h1>Stock &amp; orders</h1>
          <p>
            Count what you have on the shelf. PackPilot works out how fast you
            use bags, labels and boxes from your production in step 1 and tells
            you what to order and by when.
          </p>
        </div>
      </header>

      <DataSummary input={baseline.input} />

      <section className="panel">
        <h2>Your stock today</h2>
        <RequestState
          error={costs.error}
          onRetry={costs.retry}
          loading={!costs.data && !costs.error}
        />
        <div className="form-grid">
          {items.map((item) => (
            <div key={item.id} className="stock-item">
              <label>
                {`${item.name} in stock`}
                <input
                  inputMode="numeric"
                  placeholder="Count on the shelf"
                  value={stock[item.id] ?? ""}
                  onChange={(e) => {
                    const next = { ...stock, [item.id]: e.target.value };
                    setStock(next);
                    remember({ stock: next });
                  }}
                />
              </label>
              <small className="muted" data-testid={`use-${item.id}`}>
                {item.monthlyUse === null
                  ? "Enter kg per box below to calculate."
                  : `You use about ${count(item.monthlyUse)} a month (from step 1).`}
              </small>
            </div>
          ))}
        </div>
        <details className="reorder-more">
          <summary>Box size and minimum orders (optional)</summary>
          <div className="form-grid">
            <Q
              label="Kg of product per transport box"
              value={asQuantity(boxKg)}
              suggestion={
                mode === "demo"
                  ? { text: "12 – OG TOFU", apply: () => entered(12) }
                  : undefined
              }
              onChange={(v) => {
                setBoxKg(v.value ?? "");
                remember({ boxKg: v.value ?? "" });
              }}
            />
            {items.map((item) => (
              <Q
                key={item.id}
                label={`Minimum order · ${item.name}`}
                value={asQuantity(moq[item.id])}
                onChange={(v) => {
                  const next = { ...moq, [item.id]: v.value ?? "" };
                  setMoq(next);
                  remember({ moq: next });
                }}
              />
            ))}
          </div>
        </details>
        <fieldset className="lead-choice">
          <legend>How long does your supplier take to deliver?</legend>
          {LEAD_CHOICES.map((d) => (
            <label key={d} className="radio-option">
              <input
                type="radio"
                name="lead"
                checked={lead === String(d)}
                onChange={() => {
                  setLead(String(d));
                  remember({ lead: String(d) });
                }}
              />
              {d / 7} week{d > 7 ? "s" : ""}
            </label>
          ))}
          <label className="radio-option">
            Other:
            <input
              aria-label="Delivery time in days"
              inputMode="numeric"
              className="lead-days"
              value={lead}
              onChange={(e) => {
                setLead(e.target.value);
                remember({ lead: e.target.value });
              }}
            />
            days
          </label>
        </fieldset>
        <div className="form-grid">
          <label>
            Safety buffer
            <select
              value={bufferWeeks}
              onChange={(e) => setBufferWeeks(Number(e.target.value))}
            >
              <option value={0}>None</option>
              <option value={1}>1 week of use</option>
              <option value={2}>2 weeks of use</option>
            </select>
          </label>
          <label>
            Each order should last
            <select
              value={orderDays}
              onChange={(e) => setOrderDays(Number(e.target.value))}
            >
              <option value={14}>About 2 weeks</option>
              <option value={30}>About a month</option>
              <option value={60}>About 2 months</option>
            </select>
          </label>
        </div>
        <p className="footnote">
          Assumes no orders are already on the way. Use is spread evenly over
          the month; dates are from today, {formatDate(asOf)}.
        </p>
      </section>

      <section className="panel" aria-live="polite">
        <h2>Your reorder plan</h2>
        <RequestState error={plans.error} onRetry={plans.retry} />
        <ul className="reorder-list">
          {sorted.map(({ item, plan, status, quantity }) => (
            <li
              key={item.id}
              className={`reorder-${status}`}
              data-testid={`plan-${item.id}`}
            >
              <span className="reorder-badge">{STATUS_TEXT[status]}</span>
              <strong>{item.name}</strong>
              <span>
                {plan === null
                  ? item.monthlyUse === null
                    ? " — enter kg per box to include boxes."
                    : " — enter how many you have to see when to order."
                  : ` — enough for about ${count(plan.coverageCalendarDays)} days. Order ${count(quantity)} by ${formatDate(plan.estimatedReorderDate)}.`}
              </span>
            </li>
          ))}
        </ul>
        {orderList.length > 0 && (
          <div className="order-list">
            <h3>Order list for your supplier</h3>
            <pre data-testid="order-list">
              {`Order list – ${formatDate(asOf)}\n${orderList.join("\n")}`}
            </pre>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard
                  ?.writeText(
                    `Order list – ${formatDate(asOf)}\n${orderList.join("\n")}`,
                  )
                  .then(() => setCopied(true))
                  .catch(() => setCopied(false));
              }}
            >
              {copied ? "Copied" : "Copy order list"}
            </button>
          </div>
        )}
      </section>
    </>
  );
}
