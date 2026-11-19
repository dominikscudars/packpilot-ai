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
    const labourShare = Math.round((Number(labour) / Number(total)) * 100);
    const driver = Number(labour) >= Number(material) ? "Labour" : "Materials";
    const share = driver === "Labour" ? labourShare : 100 - labourShare;
    out.push({
      id: "driver",
      text: `${driver} is the largest cost: ${share}% of your ${euro(Number(total))} a month (materials ${euro(Number(material))}, labour ${euro(Number(labour))}).`,
    });
  } else if (total === null) {
    out.push({
      id: "driver",
      text: "Your monthly packaging cost is not complete yet; see “What is missing” below.",
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
      text: `${sizeLabel(small.grams)} packs cost ${euro(small.euroPerKg)}/kg to pack, ${ratio.toFixed(1)}× the ${euro(large.euroPerKg)}/kg of ${sizeLabel(large.grams)} packs: each pack needs its own bag, label and handling time, so smaller packs spread these over fewer grams.`,
    });
  }
  const usage = result.machineUsage.find((m) => m.utilizationPercent !== null);
  if (usage && usage.utilizationPercent !== null) {
    const pct = Math.round(Number(usage.utilizationPercent));
    out.push({
      id: "capacity",
      text:
        pct > 100
          ? `Packing needs ${pct}% of the machine hours you have available: production above this level needs more hours or faster equipment.`
          : `Packing uses about ${pct}% of the machine hours you have available.`,
    });
  } else if (result.machineHours !== null && Number(result.machineHours) > 0) {
    out.push({
      id: "capacity",
      text: `Packing takes about ${Number(result.machineHours).toFixed(1)} machine-hours a month. Add the hours your machine is available to check how much capacity is left.`,
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
        needs: `Bag and label cost for pack size ${i + 1} (ask your supplier for a quote per pack).`,
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
      needs: "Labour cost per pack or the hourly wage of the people packing.",
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
      needs:
        "Machine cycle time and packs per cycle (time one cycle with a stopwatch).",
      field: "equipment",
    });
  if (machine && machine.operators.value === null)
    out.push({
      decision: "Packing hours and labour by the hour",
      needs: "Number of people operating the machine.",
      field: "equipment",
    });
  if (machine && machine.availableHoursPerMonth.value === null)
    out.push({
      decision: "Capacity check as production grows",
      needs: "Hours the machine is available per month.",
      field: "equipment",
    });
  if (
    machine?.maintenanceEuroPerMonth.value === null ||
    input.additionalOperatingEuroPerMonth.value === null
  )
    out.push({
      decision: "Savings and payback when comparing equipment",
      needs:
        "Monthly maintenance and other recurring packaging costs (0 if none).",
      field: "other-costs",
    });
  return out;
}
