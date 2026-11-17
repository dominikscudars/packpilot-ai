import {
  D,
  decimal,
  known,
  output,
  total,
  unique,
  DomainError,
} from "../domain/inputs.js";
import { scenarioInputSchema, type ScenarioInput } from "../domain/scenario.js";
import { allocateMass } from "./allocation.js";
import type { Decimal } from "decimal.js";
export function provenance(
  value: unknown,
  path = "input",
): { assumptions: string[]; missingInputs: string[] } {
  const assumptions: string[] = [];
  const missingInputs: string[] = [];
  function visit(item: unknown, key: string) {
    if (!item || typeof item !== "object") return;
    const record = item as Record<string, unknown>;
    if ("quality" in record && "value" in record) {
      if (record.quality === "missing") missingInputs.push(key);
      if (record.quality === "assumption")
        assumptions.push(
          `${key}: ${String(record.sourceNote ?? "Unverified assumption")}`,
        );
      return;
    }
    for (const [k, v] of Object.entries(record)) visit(v, `${key}.${k}`);
  }
  visit(value, path);
  return { assumptions, missingInputs };
}
export function calculatePackaging(raw: ScenarioInput) {
  const input = scenarioInputSchema.parse(raw);
  unique(
    input.formats.map((f) => f.id),
    "format IDs",
  );
  unique(
    input.machines.map((m) => m.id),
    "machine IDs",
  );
  const production = known(input.monthlyProductionKg, "Monthly production kg");
  const formats = input.formats.map((f) => ({
    grams: known(f.portionWeightGrams, `${f.id} portion weight`),
    percent: known(f.allocationPercent, `${f.id} allocation percentage`),
  }));
  if (!total(formats.map((f) => f.percent))!.eq(100))
    throw new DomainError("Allocation percentages must total exactly 100.");
  for (const f of input.formats)
    if (
      f.machineId !== null &&
      !input.machines.some((m) => m.id === f.machineId)
    )
      throw new DomainError(`Unknown machine ${f.machineId}.`);
  const allocation = allocateMass(production, formats);
  const warnings: string[] = [];
  if (allocation.reallocated)
    warnings.push(
      "Exact production fulfillment required reallocation away from the requested mix. Review each format mass deviation.",
    );
  if (allocation.unpackagedKg.gt(0))
    warnings.push(
      `${output(allocation.unpackagedKg)} kg cannot be packed into the configured whole portions. No extra production was assumed.`,
    );
  const decimalRows = input.formats.map((f, i) => {
    const packages = allocation.counts[i];
    const amount = new D(packages);
    const unitCost =
      f.materialCost.method === "combined"
        ? decimal(f.materialCost.combinedEuroPerPackage)
        : total([
            decimal(f.materialCost.bagEuroPerPackage),
            decimal(f.materialCost.labelEuroPerPackage),
          ]);
    const material =
      packages === 0 ? new D(0) : (unitCost?.times(amount) ?? null);
    const machine = input.machines.find((m) => m.id === f.machineId);
    let machineHours: Decimal | null = packages === 0 ? new D(0) : null;
    if (packages > 0 && machine) {
      const t = machine.throughput;
      if (
        t.method === "cycle" &&
        t.packagesPerCycle.value !== null &&
        t.cycleSeconds.value !== null
      )
        machineHours = amount
          .times(t.cycleSeconds.value)
          .div(t.packagesPerCycle.value)
          .div(3600);
      if (t.method === "rate" && t.packagesPerHour.value !== null)
        machineHours = amount.div(t.packagesPerHour.value);
    }
    const personHours =
      packages === 0
        ? new D(0)
        : machineHours !== null && machine?.operators.value != null
          ? machineHours.times(machine.operators.value)
          : null;
    let labor: Decimal | null = new D(0);
    if (packages > 0)
      labor =
        input.labor.method === "perPackage"
          ? (decimal(input.labor.euroPerPackage)?.times(amount) ?? null)
          : personHours !== null && input.labor.euroPerPersonHour.value !== null
            ? personHours.times(input.labor.euroPerPersonHour.value)
            : null;
    return {
      id: f.id,
      machineId: f.machineId,
      packages,
      requestedKg: allocation.targetsGrams[i].div(1000),
      packedKg: amount.times(formats[i].grams).div(1000),
      material,
      labor,
      machineHours,
      personHours,
    };
  });
  const used = input.machines.filter((m) =>
    input.formats.some(
      (f) =>
        f.machineId === m.id &&
        known(f.allocationPercent, "Allocation percentage").gt(0),
    ),
  );
  const material = total(decimalRows.map((r) => r.material));
  const labor = total(decimalRows.map((r) => r.labor));
  const operating = total([material, labor]);
  const machineHours = total(decimalRows.map((r) => r.machineHours));
  const personHours = total(decimalRows.map((r) => r.personHours));
  const recurring = total([
    decimal(input.additionalOperatingEuroPerMonth),
    ...used.map((m) => decimal(m.maintenanceEuroPerMonth)),
  ]);
  const investment =
    used.length === 0
      ? null
      : total(used.map((m) => decimal(m.investmentEuro)));
  if (material === null)
    warnings.push(
      "Material cost is unknown: at least one required price is missing.",
    );
  if (labor === null)
    warnings.push(
      "Labor cost is unknown: a rate, throughput or operator count is missing.",
    );
  if (machineHours === null || personHours === null)
    warnings.push("Some machine-hours or person-hours are unknown.");
  if (recurring === null)
    warnings.push(
      "Recurring operating costs are incomplete; net investment savings cannot be established.",
    );
  const machineUsage = used.map((m) => {
    const hours = total(
      decimalRows
        .filter((r) => r.machineId === m.id)
        .map((r) => r.machineHours),
    );
    const utilization =
      hours !== null && m.availableHoursPerMonth.value !== null
        ? hours.div(m.availableHoursPerMonth.value).times(100)
        : null;
    if (utilization?.gt(100))
      warnings.push(`Machine ${m.id} exceeds its declared available hours.`);
    return {
      machineId: m.id,
      machineHours: output(hours),
      utilizationPercent: output(utilization),
    };
  });
  const totalPackages = decimalRows.reduce((n, r) => n + r.packages, 0);
  if (!Number.isSafeInteger(totalPackages))
    throw new DomainError("Total package count exceeds safe integers.");
  return {
    currency: "EUR" as const,
    resultType: "modeled" as const,
    monthlyProductionKg: output(production)!,
    packedProductionKg: output(allocation.packedKg)!,
    unpackagedProductionKg: output(allocation.unpackagedKg)!,
    productionDifferenceKg: output(allocation.packedKg.minus(production))!,
    rows: decimalRows.map((r) => ({
      formatId: r.id,
      packages: r.packages,
      requestedKg: output(r.requestedKg)!,
      packedKg: output(r.packedKg)!,
      allocationDifferenceKg: output(r.packedKg.minus(r.requestedKg))!,
      materialEuro: output(r.material),
      laborEuro: output(r.labor),
      machineHours: output(r.machineHours),
      personHours: output(r.personHours),
    })),
    totalPackages,
    totalMaterialEuro: output(material),
    totalLaborEuro: output(labor),
    totalPackagingOperatingEuro: output(operating),
    packagingEuroPerPlannedKg: production.isZero()
      ? null
      : output(operating?.div(production) ?? null),
    packagingEuroPerPackedKg: allocation.packedKg.isZero()
      ? null
      : output(operating?.div(allocation.packedKg) ?? null),
    machineHours: output(machineHours),
    personHours: output(personHours),
    machineUsage,
    recurringOperatingEuroPerMonth: output(recurring),
    totalIncludingRecurringEuro: output(total([operating, recurring])),
    investmentEuro: output(investment),
    ...provenance(input),
    warnings,
    exclusions: [
      "Equipment investment/depreciation is excluded from monthly operating cost.",
      "Energy, freight, taxes, waste, setup and other overhead are excluded unless explicitly entered as additional recurring costs.",
    ],
  };
}
export type PackagingCostResult = ReturnType<typeof calculatePackaging>;
