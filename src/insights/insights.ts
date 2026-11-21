import type { PackagingCostResult, ScenarioInput } from "../models/api";
import { fieldIds } from "../setup/setupState";

/**
 * Decision support derived only from the engine's results and the saved
 * inputs. Observations describe the calculation; they are never presented as
 * guaranteed savings.
 */

export interface Observation {
  id: string;
  text: string;
}

const euro = (v: number, digits = 2) =>
  `€${v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
const sizeLabel = (grams: number) =>
  grams >= 1000 && grams % 1000 === 0 ? `${grams / 1000} kg` : `${grams} g`;

export function observations(
  result: PackagingCostResult,
  input: ScenarioInput,
): Observation[] {
  const out: Observation[] = [];
  const material = result.totalMaterialEuro;
  const labour = result.totalLaborEuro;
  const total = result.totalPackagingOperatingEuro;
  if (
    material !== null &&
    labour !== null &&
    total !== null &&
    Number(total) > 0
  ) {
    // Same total as the cost breakdown bar: materials, labour and any
    // other recurring costs entered.
    const whole =
      Number(total) + Number(result.recurringOperatingEuroPerMonth ?? 0);
    const driver = Number(labour) >= Number(material) ? "Labour" : "Materials";
    const share = Math.round(
      (Number(driver === "Labour" ? labour : material) / whole) * 100,
    );
    out.push({
      id: "driver",
      text: `${driver} is ${share}% of your monthly cost.`,
    });
  } else if (total === null) {
    out.push({
      id: "driver",
      text: "Some costs are still missing.",
    });
  }
  const perKg = result.rows
    .map((row) => ({
      grams: Number(
        input.formats.find((f) => f.id === row.formatId)?.portionWeightGrams
          .value,
      ),
      euroPerKg:
        row.packagingEuroPerPackedKg === null
          ? null
          : Number(row.packagingEuroPerPackedKg),
    }))
    .filter(
      (r): r is { grams: number; euroPerKg: number } =>
        r.grams > 0 && r.euroPerKg !== null && r.euroPerKg > 0,
    )
    .sort((a, b) => a.grams - b.grams);
  const small = perKg.at(0);
  const large = perKg.at(-1);
  if (small && large && small.grams !== large.grams) {
    const ratio = small.euroPerKg / large.euroPerKg;
    out.push({
      id: "small-packs",
      text: `${sizeLabel(small.grams)} packs cost ${ratio.toFixed(1)}× more per kg than ${sizeLabel(large.grams)} packs (${euro(small.euroPerKg)} vs ${euro(large.euroPerKg)}).`,
    });
  }
  const usage = result.machineUsage.find((m) => m.utilizationPercent !== null);
  if (usage && usage.utilizationPercent !== null) {
    const pct = Math.round(Number(usage.utilizationPercent));
    out.push({
      id: "capacity",
      text:
        pct > 100
          ? `Packing needs ${pct}% of your machine hours.`
          : `Packing uses ${pct}% of your machine hours.`,
    });
  }
  return out.slice(0, 3);
}

/** A decision that is blocked until certain inputs are known. */
export interface MissingInput {
  decision: string;
  needs: string;
  field: string;
}

/**
 * Which missing inputs block which decisions, most fundamental first.
 * Each item links to the field to fill in.
 */
export function completeness(input: ScenarioInput): MissingInput[] {
  const out: MissingInput[] = [];
  input.formats.forEach((f, i) => {
    const cost = f.materialCost;
    const unknown =
      cost.method === "combined"
        ? cost.combinedEuroPerPackage.value === null
        : cost.bagEuroPerPackage.value === null ||
          cost.labelEuroPerPackage.value === null;
    if (unknown)
      out.push({
        decision: "Monthly cost and cost per kg",
        needs: `Bag and label cost for pack size ${i + 1}`,
        field: fieldIds.material(i),
      });
  });
  if (
    input.labor.method === "perPackage"
      ? input.labor.euroPerPackage.value === null
      : input.labor.euroPerPersonHour.value === null
  )
    out.push({
      decision: "Monthly cost and cost per kg",
      needs: "Labour cost",
      field: "labour",
    });
  const machine = input.machines.at(0);
  const t = machine?.throughput;
  const timingUnknown =
    !t ||
    (t.method === "cycle"
      ? t.cycleSeconds.value === null || t.packagesPerCycle.value === null
      : t.packagesPerHour.value === null);
  if (timingUnknown)
    out.push({
      decision: "Packing hours and labour by the hour",
      needs: "Machine cycle time and packs per cycle",
      field: "equipment",
    });
  if (machine && machine.operators.value === null)
    out.push({
      decision: "Packing hours and labour by the hour",
      needs: "Number of machine operators",
      field: "equipment",
    });
  if (machine && machine.availableHoursPerMonth.value === null)
    out.push({
      decision: "Capacity check as production grows",
      needs: "Machine hours available per month",
      field: "equipment",
    });
  if (
    machine?.maintenanceEuroPerMonth.value === null ||
    input.additionalOperatingEuroPerMonth.value === null
  )
    out.push({
      decision: "Savings and payback when comparing equipment",
      needs: "Maintenance and other monthly costs (0 if none)",
      field: "other-costs",
    });
  return out;
}
