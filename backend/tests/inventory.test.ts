import { describe, it, expect } from "vitest";
import { planInventory } from "../src/calculation-engine/inventory.js";
import { assumed, missing } from "../src/domain/inputs.js";
import { inventoryPlanSchema } from "../src/domain/inventory.js";
const q = (v: string) => assumed(v, "Test assumption");
const fixture = () =>
  inventoryPlanSchema.parse({
    currentStockPackages: q("1500"),
    expectedMonthlyConsumptionPackages: q("3000"),
    calendarDaysInPlanningMonth: q("30"),
    workingDaysInPlanningMonth: q("20"),
    leadTimeCalendarDays: q("5"),
    minimumOrderPackages: q("2000"),
    safetyStockPackages: q("100"),
    reviewPeriodCalendarDays: q("10"),
    asOfDate: "2026-11-17",
    outstandingPurchaseOrders: [],
  });
describe("inventory planning", () => {
  it("calculates calendar and working rates, coverage, reorder date and MOQ", () => {
    expect(planInventory(fixture())).toMatchObject({
      consumptionPerCalendarDayPackages: "100",
      consumptionPerWorkingDayPackages: "150",
      consumptionPerWeekPackages: "700",
      coverageCalendarDays: "15",
      reorderPointPackages: "600",
      estimatedReorderDate: "2026-11-26",
      suggestedOrderPackages: "2000",
    });
  });
  it("orders nothing if stock already covers the horizon and safety stock", () => {
    const i = fixture();
    i.currentStockPackages = q("2000");
    expect(planInventory(i).suggestedOrderPackages).toBe("0");
  });
  it("handles zero consumption without infinity or a fake reorder date", () => {
    const i = fixture();
    i.expectedMonthlyConsumptionPackages = q("0");
    expect(planInventory(i)).toMatchObject({
      coverageStatus: "unbounded",
      coverageCalendarDays: null,
      estimatedReorderDate: null,
      suggestedOrderPackages: "0",
    });
  });
  it("supports safety-stock replenishment even with zero consumption", () => {
    const i = fixture();
    i.expectedMonthlyConsumptionPackages = q("0");
    i.currentStockPackages = q("0");
    expect(planInventory(i).suggestedOrderPackages).toBe("2000");
  });
  it("preserves unknown consumption", () => {
    const i = fixture();
    i.expectedMonthlyConsumptionPackages = missing();
    expect(planInventory(i)).toMatchObject({
      consumptionPerCalendarDayPackages: null,
      coverageCalendarDays: null,
      reorderPointPackages: null,
      suggestedOrderPackages: null,
    });
  });
  it("does not assume unknown outstanding orders are zero", () => {
    const i = fixture();
    i.outstandingPurchaseOrders = null;
    expect(planInventory(i).suggestedOrderPackages).toBeNull();
  });
  it("credits confirmed timely receipts and shifts the modeled reorder date", () => {
    const i = fixture();
    i.outstandingPurchaseOrders = [
      { quantityPackages: q("400"), dueDate: "2026-11-20" },
    ];
    expect(planInventory(i)).toMatchObject({
      eligiblePurchaseOrderPackages: "400",
      estimatedReorderDate: "2026-11-30",
      suggestedOrderPackages: "0",
    });
  });
  it("does not credit receipts due after lead-time arrival", () => {
    const i = fixture();
    i.outstandingPurchaseOrders = [
      { quantityPackages: q("400"), dueDate: "2026-12-20" },
    ];
    expect(planInventory(i)).toMatchObject({
      eligiblePurchaseOrderPackages: "0",
      suggestedOrderPackages: "2000",
    });
  });
  it("requires confirmation of overdue receipts", () => {
    const i = fixture();
    i.outstandingPurchaseOrders = [
      { quantityPackages: q("400"), dueDate: "2026-11-16" },
    ];
    expect(planInventory(i).suggestedOrderPackages).toBeNull();
  });
  it("does not invent a date without an as-of date", () => {
    const i = fixture();
    delete i.asOfDate;
    expect(planInventory(i).estimatedReorderDate).toBeNull();
  });
  it.each(["0", "32"])("rejects invalid calendar day count %s", (v) => {
    const i = fixture();
    i.calendarDaysInPlanningMonth = q(v);
    expect(() => planInventory(i)).toThrow();
  });
  it("rejects negative stock, fractional MOQ and impossible working days", () => {
    const i = fixture();
    i.currentStockPackages = q("-1");
    expect(() => planInventory(i)).toThrow();
    i.currentStockPackages = q("1");
    i.minimumOrderPackages = q("1.5");
    expect(() => planInventory(i)).toThrow();
    i.minimumOrderPackages = q("1");
    i.workingDaysInPlanningMonth = q("31");
    expect(() => planInventory(i)).toThrow();
  });
});
