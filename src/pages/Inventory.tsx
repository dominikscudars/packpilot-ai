import { useState } from "react";
import { NextStep } from "../components/NextStep";
import type {
  InventoryPlanInput,
  Quantity,
  RecordOf,
  Resources,
} from "../models/api";
import { missing } from "../../backend/src/domain/inputs";
import { useWorkspace } from "../components/WorkspaceProvider";
import { QuantityField as Q } from "../components/QuantityField";
import { useRequest, RequestState, message } from "../components/AsyncState";
import { Notes, decimalText } from "../components/ApiResults";
function Planner({ record }: { record?: RecordOf<Resources["inventory"]> }) {
  const { gateway, saveRecord } = useWorkspace();
  const [input, setInput] = useState<InventoryPlanInput>(() => ({
    currentStockPackages: record?.currentStockPackages ?? missing(),
    expectedMonthlyConsumptionPackages: missing(),
    calendarDaysInPlanningMonth: missing(),
    workingDaysInPlanningMonth: missing(),
    leadTimeCalendarDays: record?.supplierLeadTimeCalendarDays ?? missing(),
    minimumOrderPackages: record?.minimumOrderPackages ?? missing(),
    safetyStockPackages: record?.safetyStockPackages ?? missing(),
    reviewPeriodCalendarDays: missing(),
    outstandingPurchaseOrders: null,
  }));
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const state = useRequest(JSON.stringify(input), () =>
    gateway.inventory(input),
  );
  type QuantityKey = {
    [K in keyof InventoryPlanInput]: InventoryPlanInput[K] extends Quantity
      ? K
      : never;
  }[keyof InventoryPlanInput];
  const fields: [NonNullable<QuantityKey>, string][] = [
    ["currentStockPackages", "Current stock (packages)"],
    [
      "expectedMonthlyConsumptionPackages",
      "Expected monthly consumption (packages)",
    ],
    ["calendarDaysInPlanningMonth", "Calendar days in planning month"],
    ["workingDaysInPlanningMonth", "Working days in planning month"],
    ["leadTimeCalendarDays", "Supplier lead time (calendar days)"],
    ["minimumOrderPackages", "Minimum order (packages)"],
    ["safetyStockPackages", "Safety stock (packages)"],
    ["reviewPeriodCalendarDays", "Review period (calendar days)"],
  ];
  return (
    <>
      <section className="panel">
        <h2>Planning inputs</h2>
        <p className="muted">
          Enter demand in packages for this material or format. Demand is not
          inferred from an unrelated scenario. Blank values remain unknown.
        </p>
        <fieldset disabled={busy} className="plain-fieldset">
          <div className="form-grid">
            {fields.map(([key, label]) => (
              <Q
                key={key}
                label={label}
                value={input[key]}
                onChange={(value) => {
                  setInput({ ...input, [key]: value });
                  setNotice("");
                }}
              />
            ))}
            <label>
              As-of date (UTC)
              <input
                type="date"
                value={input.asOfDate ?? ""}
                onChange={(e) =>
                  setInput({ ...input, asOfDate: e.target.value || undefined })
                }
              />
            </label>
            <label>
              Outstanding purchase orders
              <select
                value={
                  input.outstandingPurchaseOrders === null
                    ? "unknown"
                    : input.outstandingPurchaseOrders.length
                      ? "listed"
                      : "none"
                }
                onChange={(e) =>
                  setInput({
                    ...input,
                    outstandingPurchaseOrders:
                      e.target.value === "unknown"
                        ? null
                        : e.target.value === "none"
                          ? []
                          : [{ quantityPackages: missing(), dueDate: "" }],
                  })
                }
              >
                <option value="unknown">Unknown</option>
                <option value="none">Confirmed: none outstanding</option>
                <option value="listed">Enter confirmed orders</option>
              </select>
            </label>
          </div>
          {input.outstandingPurchaseOrders?.map((po, i) => (
            <div className="form-grid" key={i}>
              <Q
                label={`Incoming packages · ${i + 1}`}
                value={po.quantityPackages}
                onChange={(quantityPackages) =>
                  setInput({
                    ...input,
                    outstandingPurchaseOrders:
                      input.outstandingPurchaseOrders?.map((p, index) =>
                        index === i ? { ...p, quantityPackages } : p,
                      ) ?? null,
                  })
                }
              />
              <label>
                Due date
                <input
                  type="date"
                  value={po.dueDate}
                  onChange={(e) =>
                    setInput({
                      ...input,
                      outstandingPurchaseOrders:
                        input.outstandingPurchaseOrders?.map((p, index) =>
                          index === i ? { ...p, dueDate: e.target.value } : p,
                        ) ?? null,
                    })
                  }
                />
              </label>
              <button
                className="secondary"
                onClick={() =>
                  setInput({
                    ...input,
                    outstandingPurchaseOrders:
                      input.outstandingPurchaseOrders?.filter(
                        (_, index) => index !== i,
                      ) ?? null,
                  })
                }
              >
                Remove order {i + 1}
              </button>
            </div>
          ))}
          {input.outstandingPurchaseOrders !== null && (
            <button
              className="secondary"
              onClick={() =>
                setInput({
                  ...input,
                  outstandingPurchaseOrders: [
                    ...(input.outstandingPurchaseOrders ?? []),
                    { quantityPackages: missing(), dueDate: "" },
                  ],
                })
              }
            >
              Add purchase order
            </button>
          )}
          {record && (
            <div className="actions">
              <button
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  setNotice("");
                  try {
                    await saveRecord("inventory", record, {
                      formatId: record.formatId,
                      materialId: record.materialId,
                      packagesPerProductionKg: record.packagesPerProductionKg,
                      currentStockPackages: input.currentStockPackages,
                      supplierLeadTimeCalendarDays: input.leadTimeCalendarDays,
                      minimumOrderPackages: input.minimumOrderPackages,
                      safetyStockPackages: input.safetyStockPackages,
                    });
                    setNotice(
                      "Stock, lead time, MOQ and safety stock saved. Forecast inputs remain an unsaved planning snapshot.",
                    );
                  } catch (e) {
                    setError(message(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Saving…" : "Save inventory record"}
              </button>
            </div>
          )}
        </fieldset>
        <RequestState error={error} />
        {notice && <p role="status">{notice}</p>}
      </section>
      <RequestState
        error={state.error}
        onRetry={state.retry}
        loading={!state.data && !state.error}
      />
      {state.data && (
        <>
          <section className="panel">
            <h2>Inventory plan</h2>
            <dl className="inventory-results">
              <dt>Consumption / calendar day</dt>
              <dd>
                {decimalText(state.data.consumptionPerCalendarDayPackages)}{" "}
                packages
              </dd>
              <dt>Consumption / working day</dt>
              <dd>
                {decimalText(state.data.consumptionPerWorkingDayPackages)}{" "}
                packages
              </dd>
              <dt>Consumption / week</dt>
              <dd>
                {decimalText(state.data.consumptionPerWeekPackages)} packages
              </dd>
              <dt>Stock coverage</dt>
              <dd>
                {state.data.coverageStatus === "unbounded"
                  ? "Unbounded (zero demand)"
                  : `${decimalText(state.data.coverageCalendarDays)} calendar days`}
              </dd>
              <dt>Reorder point</dt>
              <dd data-testid="reorder-point">
                {decimalText(state.data.reorderPointPackages, 0)} packages
              </dd>
              <dt>Estimated reorder date</dt>
              <dd>{state.data.estimatedReorderDate ?? "Unknown"}</dd>
              <dt>Eligible incoming orders</dt>
              <dd>
                {decimalText(state.data.eligiblePurchaseOrderPackages, 0)}{" "}
                packages
              </dd>
              <dt>Suggested order</dt>
              <dd data-testid="suggested-order">
                {decimalText(state.data.suggestedOrderPackages, 0)} packages
              </dd>
            </dl>
          </section>
          <Notes data={state.data} />
        </>
      )}
    </>
  );
}
export function Inventory() {
  const { catalog } = useWorkspace();
  const [selected, setSelected] = useState(catalog.inventory[0]?.id ?? "");
  const record = catalog.inventory.find((r) => r.id === selected);
  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">STEP 4 OF 5</span>
          <h1>Inventory planning</h1>
          <p>Forecast packaging needs using the inventory calculator.</p>
        </div>
      </header>
      <section className="panel">
        {catalog.inventory.length ? (
          <label>
            Inventory record
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
            >
              {catalog.inventory.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.materialId
                    ? (catalog.materials.find((m) => m.id === r.materialId)
                        ?.name ?? r.materialId)
                    : `${catalog.formats.find((f) => f.id === r.formatId)?.portionWeightGrams.value ?? "?"} g format`}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p>
            No saved inventory records. You can calculate an unsaved plan;
            create inventory records through the company API to persist stock
            inputs.
          </p>
        )}
      </section>
      <Planner key={selected} record={record} />
      <NextStep to="/advisor" label="ask the upgrade advisor" />
    </>
  );
}
