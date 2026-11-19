import { D, decimal, output, DomainError } from "../domain/inputs.js";
import { inventoryPlanSchema } from "../domain/inventory.js";
import { provenance } from "./packaging.js";
import type { z } from "zod";
function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function planInventory(raw: z.input<typeof inventoryPlanSchema>) {
  const input = inventoryPlanSchema.parse(raw);
  const warnings: string[] = [];
  const stock = decimal(input.currentStockPackages),
    consumption = decimal(input.expectedMonthlyConsumptionPackages),
    calendarDays = decimal(input.calendarDaysInPlanningMonth),
    workingDays = decimal(input.workingDaysInPlanningMonth),
    lead = decimal(input.leadTimeCalendarDays),
    moq = decimal(input.minimumOrderPackages),
    safety = decimal(input.safetyStockPackages),
    review = decimal(input.reviewPeriodCalendarDays);
  if (calendarDays && (calendarDays.lt(28) || calendarDays.gt(31)))
    throw new DomainError("Calendar days in the planning month must be 28–31.");
  if (
    workingDays &&
    (workingDays.gt(31) || (calendarDays && workingDays.gt(calendarDays)))
  )
    throw new DomainError("Working days cannot exceed calendar days.");
  if (lead?.gt(3660) || review?.gt(3660))
    throw new DomainError(
      "Planning lead/review periods cannot exceed 3,660 days.",
    );
  const daily =
    consumption !== null && calendarDays !== null
      ? consumption.div(calendarDays)
      : null;
  const perWorkDay =
    consumption !== null && workingDays !== null
      ? consumption.div(workingDays)
      : null;
  const reorderPoint =
    daily !== null && lead !== null && safety !== null
      ? daily.times(lead).plus(safety).ceil()
      : null;
  const coverage =
    stock !== null && daily !== null && daily.gt(0) ? stock.div(daily) : null;
  const pos = input.outstandingPurchaseOrders;
  let receiptQuantity = pos?.length === 0 ? new D(0) : null;
  let eligibleReceipts: { quantity: string; dueDate: string }[] = [];
  if (pos !== null && pos.length > 0 && input.asOfDate && lead !== null) {
    receiptQuantity = new D(0);
    const arrival = addDays(input.asOfDate, lead.toNumber());
    for (const po of pos) {
      if (po.quantityPackages.value === null) {
        receiptQuantity = null;
        warnings.push("A purchase order quantity is missing.");
        break;
      }
      if (po.dueDate < input.asOfDate) {
        receiptQuantity = null;
        warnings.push(
          "An overdue purchase order requires confirmation before it can be counted.",
        );
        break;
      }
      if (po.dueDate <= arrival) {
        receiptQuantity = receiptQuantity.plus(po.quantityPackages.value);
        eligibleReceipts.push({
          quantity: po.quantityPackages.value,
          dueDate: po.dueDate,
        });
      } else
        warnings.push(
          "A purchase order arriving after the lead-time window was excluded from the suggested order.",
        );
    }
  }
  if (pos === null)
    warnings.push(
      "Outstanding purchase orders are unknown. Use an explicit empty array only when none are outstanding.",
    );
  if (pos !== null && pos.length > 0 && !input.asOfDate)
    warnings.push("An as-of date is needed to assess purchase order timing.");
  let order = null;
  if (
    daily !== null &&
    stock !== null &&
    lead !== null &&
    review !== null &&
    safety !== null &&
    moq !== null &&
    receiptQuantity !== null
  ) {
    const need = D.max(
      daily
        .times(lead.plus(review))
        .plus(safety)
        .minus(stock)
        .minus(receiptQuantity),
      0,
    ).ceil();
    order = need.gt(0) ? D.max(need, moq) : new D(0);
  }
  let reorderDate: string | null = null;
  if (
    input.asOfDate &&
    stock !== null &&
    daily !== null &&
    daily.gt(0) &&
    reorderPoint !== null &&
    receiptQuantity !== null
  ) {
    let effective = stock;
    for (const po of eligibleReceipts.sort((a, b) =>
      a.dueDate.localeCompare(b.dueDate),
    )) {
      const days = D.max(
        effective.minus(reorderPoint).div(daily).floor(),
        0,
      ).toNumber();
      if (days > 3660) break;
      if (po.dueDate <= addDays(input.asOfDate, days))
        effective = effective.plus(po.quantity);
    }
    const days = D.max(
      effective.minus(reorderPoint).div(daily).floor(),
      0,
    ).toNumber();
    if (days <= 3660) reorderDate = addDays(input.asOfDate, days);
    else warnings.push("Reorder date exceeds the 10-year planning limit.");
  }
  if (consumption === null)
    warnings.push("Consumption is missing; demand-driven outputs are unknown.");
  if (consumption?.isZero())
    warnings.push(
      "Zero consumption: coverage is unbounded (returned as null), and no consumption-based reorder date is calculated. Safety-stock replenishment may still apply.",
    );
  if (coverage !== null && lead !== null && coverage.lt(lead))
    warnings.push(
      "On-hand coverage is shorter than supplier lead time; review the risk of a stockout.",
    );
  return {
    consumptionPerCalendarDayPackages: output(daily),
    consumptionPerWorkingDayPackages: output(perWorkDay),
    consumptionPerWeekPackages: output(daily?.times(7) ?? null),
    coverageCalendarDays: output(coverage),
    coverageStatus: consumption?.isZero()
      ? "unbounded"
      : coverage === null
        ? "unknown"
        : "finite",
    reorderPointPackages: output(reorderPoint),
    estimatedReorderDate: reorderDate,
    eligiblePurchaseOrderPackages: output(receiptQuantity),
    suggestedOrderPackages: output(order),
    ...provenance(input),
    warnings,
    assumptions: [
      "Uniform consumption across the explicitly supplied calendar month; working-day rate is reported separately.",
      "Lead times, coverage and reorder dates use calendar days and UTC dates.",
      "Order-up-to horizon is lead time plus review period; MOQ is a minimum, not an order multiple.",
      "Only confirmed receipts due by lead-time arrival are credited; supplier delays are not predicted.",
      "This is a planning snapshot, not real-time inventory integration.",
    ],
  };
}
