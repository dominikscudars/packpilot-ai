import { writeFile } from "node:fs/promises";
import { createDemoScenario } from "../src/domain/demo.js";
import { assumed } from "../src/domain/inputs.js";
const q = (value: string) =>
  assumed(value, "Synthetic documentation example; not verified OG TOFU data.");
const baseline = createDemoScenario(),
  alternative = createDemoScenario();
for (const s of [baseline, alternative]) {
  s.additionalOperatingEuroPerMonth = q("0");
  s.machines[0].maintenanceEuroPerMonth = q("0");
}
alternative.labor = { method: "perPackage", euroPerPackage: q("0.10") };
alternative.machines[0].investmentEuro = q("1000");
alternative.machines[0].maintenanceEuroPerMonth = q("15");
for (const [name, value] of Object.entries({
  "packaging-costs": createDemoScenario(),
  "compare-scenarios": { baseline, alternative, sameProductAndDemand: true },
  "inventory-plan": {
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
  },
})) {
  await writeFile(
    `examples/${name}.json`,
    JSON.stringify(value, null, 2) + "\n",
  );
}
