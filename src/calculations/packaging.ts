import Decimal from "decimal.js";
import { catalogSchema, scenarioSchema } from "../models/schema";
import type {
  CalculationCatalog,
  PackagingCostResult,
  PackagingCostRow,
  ProductionScenario,
} from "../models/types";
const D = Decimal.clone({ precision: 40 });
const sum = (values: (number | null)[]): number | null =>
  values.some((v) => v === null)
    ? null
    : values.reduce<Decimal>((a, v) => a.plus(v!), new D(0)).toNumber();
function unique(ids: string[], label: string) {
  if (new Set(ids).size !== ids.length)
    throw new Error(`Duplicate ${label} IDs are not allowed.`);
}
/** Deterministic monthly estimate. See CALCULATIONS.md for formulas and rounding. */
export function calculatePackaging(
  scenario: ProductionScenario,
  catalog: CalculationCatalog,
): PackagingCostResult {
  scenario = scenarioSchema.parse(scenario);
  catalog = catalogSchema.parse(catalog);
  for (const [label, items] of Object.entries(catalog))
    unique(
      items.map((item: { id: string }) => item.id),
      label,
    );
  unique(
    scenario.plans.map((p) => p.productId),
    "product plan",
  );
  for (const machine of catalog.machines) {
    for (const field of [
      "packagesPerCycle",
      "cycleSeconds",
      "workers",
    ] as const) {
      const value = machine[field].value;
      if (
        value !== null &&
        (value <= 0 || (field !== "cycleSeconds" && !Number.isInteger(value)))
      )
        throw new Error(
          `${machine.name}: ${field} must be positive${field !== "cycleSeconds" ? " and a whole number" : ""}.`,
        );
    }
  }
  const rows: PackagingCostRow[] = [];
  const warnings = new Set<string>();
  for (const plan of scenario.plans) {
    if (!catalog.products.some((p) => p.id === plan.productId))
      throw new Error("Unknown product reference.");
    unique(
      plan.allocations.map((a) => a.formatId),
      "allocation format",
    );
    if (plan.productionKg.value === null)
      throw new Error("Enter monthly production in kg to calculate results.");
    if (
      plan.allocations.some(
        (a) => a.shareByWeight.value === null || a.shareByWeight.value > 1,
      )
    )
      throw new Error("Enter each packaging share between 0% and 100%.");
    const totalShare = plan.allocations.reduce(
      (total, a) => total.plus(a.shareByWeight.value!),
      new D(0),
    );
    if (totalShare.minus(1).abs().greaterThan("0.000000001"))
      throw new Error("Packaging shares must total 100% for each product.");
    for (const allocation of plan.allocations) {
      const format = catalog.formats.find((f) => f.id === allocation.formatId);
      if (!format) throw new Error("Unknown packaging format reference.");
      if (!catalog.materials.some((m) => m.id === format.materialId))
        throw new Error("Unknown packaging material reference.");
      const machine = catalog.machines.find((m) => m.id === format.machineId);
      if (format.machineId && !machine)
        throw new Error("Unknown packaging machine reference.");
      // Normalize only the accepted floating point tolerance around a total share of 1.
      const target = new D(plan.productionKg.value)
        .times(allocation.shareByWeight.value!)
        .div(totalShare);
      const packages = target
        .times(1000)
        .div(format.netWeightGrams)
        .ceil()
        .toNumber();
      if (!Number.isSafeInteger(packages))
        throw new Error(
          "Package count exceeds the supported safe integer range.",
        );
      const capacity = new D(packages).times(format.netWeightGrams).div(1000);
      let machineHours: number | null = packages === 0 ? 0 : null;
      let laborHours: number | null = packages === 0 ? 0 : null;
      if (
        packages > 0 &&
        machine?.packagesPerCycle.value != null &&
        machine.cycleSeconds.value != null
      ) {
        machineHours = new D(packages)
          .div(machine.packagesPerCycle.value)
          .ceil()
          .times(machine.cycleSeconds.value)
          .div(3600)
          .toNumber();
        if (machine.workers.value !== null)
          laborHours = new D(machineHours)
            .times(machine.workers.value)
            .toNumber();
      }
      const materialEuro =
        packages === 0
          ? 0
          : allocation.materialEuroPerPackage.value === null
            ? null
            : new D(packages)
                .times(allocation.materialEuroPerPackage.value)
                .toNumber();
      let laborEuro: number | null = 0;
      if (packages > 0) {
        if (scenario.labor.method === "perPackage")
          laborEuro =
            scenario.labor.euroPerPackage.value === null
              ? null
              : new D(packages)
                  .times(scenario.labor.euroPerPackage.value)
                  .toNumber();
        else
          laborEuro =
            scenario.labor.euroPerWorkerHour.value === null ||
            laborHours === null
              ? null
              : new D(laborHours)
                  .times(scenario.labor.euroPerWorkerHour.value)
                  .toNumber();
      }
      if (materialEuro === null)
        warnings.add(
          "Material prices are missing; material and total operating costs are unknown.",
        );
      if (laborEuro === null)
        warnings.add(
          "Labor pricing or processing inputs are missing; labor and total operating costs are unknown.",
        );
      if (laborHours === null)
        warnings.add(
          "Processing time or staffing is missing; labor hours are unknown.",
        );
      rows.push({
        productId: plan.productId,
        formatId: format.id,
        targetKg: target.toNumber(),
        packages,
        packagedCapacityKg: capacity.toNumber(),
        materialEuro,
        laborEuro,
        operatingEuro: sum([materialEuro, laborEuro]),
        machineHours,
        laborHours,
      });
    }
  }
  const productionKg = sum(scenario.plans.map((p) => p.productionKg.value))!;
  const totalPackages = sum(rows.map((r) => r.packages))!;
  if (!Number.isSafeInteger(totalPackages))
    throw new Error(
      "Total package count exceeds the supported safe integer range.",
    );
  const materialEuro = sum(rows.map((r) => r.materialEuro));
  const laborEuro = sum(rows.map((r) => r.laborEuro));
  const operatingEuro = sum([materialEuro, laborEuro]);
  return {
    productionKg,
    totalPackages,
    packagedCapacityKg: sum(rows.map((r) => r.packagedCapacityKg))!,
    materialEuro,
    laborEuro,
    operatingEuro,
    euroPerKg:
      productionKg === 0 || operatingEuro === null
        ? null
        : new D(operatingEuro).div(productionKg).toNumber(),
    laborHours: sum(rows.map((r) => r.laborHours)),
    rows,
    warnings: [...warnings],
  };
}
