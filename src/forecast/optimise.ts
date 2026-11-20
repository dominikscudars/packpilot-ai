import { Decimal } from "decimal.js";
import type { Quantity, ScenarioInput } from "../models/api";
import { calculatePackaging } from "../../backend/src/calculation-engine/packaging";

/**
 * Ways to optimise the forecast: concrete changes, each recalculated with
 * the deterministic engine on the projected end-of-period scenario. Only
 * options the entered data can support are offered, and each states the
 * assumption it rests on.
 */
export interface Option {
  id: "capacity" | "machine" | "mix" | "material" | "labour";
  title: string;
  why: string;
  assumption: string;
  /** Monthly packaging cost saved versus the projection (null: not known). */
  savingEuro: number | null;
  euroPerKg: { from: number | null; to: number | null };
  machineHours: { from: number | null; to: number | null };
  /** True if it brings packing back within the available machine hours. */
  solvesCapacity: boolean;
  /** Question to send to market research for prices and suppliers. */
  research: string;
  /** "Test a cost change" can model this option directly. */
  testable: boolean;
}

const NOTE = "Optimisation option; planning assumption.";
const num = (v: string | null) => (v === null ? null : Number(v));
const q = (v: Decimal | number | string): Quantity => ({
  value: new Decimal(v).toDecimalPlaces(6).toString(),
  quality: "assumption",
  sourceNote: NOTE,
});
const known = (x: Quantity) =>
  x.value !== null && Number.isFinite(Number(x.value));
const size = (grams: number) =>
  grams >= 1000 && grams % 1000 === 0
    ? `${grams / 1000}\u00a0kg`
    : `${grams}\u00a0g`;

function measure(input: ScenarioInput) {
  const r = calculatePackaging(input);
  return {
    cost: num(r.totalPackagingOperatingEuro),
    perKg: num(r.packagingEuroPerPlannedKg),
    hours: num(r.machineHours),
    packages: r.totalPackages,
  };
}

export function optimisations(end: ScenarioInput): {
  options: Option[];
  base: ReturnType<typeof measure>;
  available: number | null;
  overCapacity: boolean;
} {
  const base = measure(end);
  const machine = end.machines[0];
  const available = machine ? num(machine.availableHoursPerMonth.value) : null;
  const overCapacity =
    available !== null && base.hours !== null && base.hours > available;
  const options: Option[] = [];
  const option = (
    partial: Omit<
      Option,
      "savingEuro" | "euroPerKg" | "machineHours" | "solvesCapacity"
    >,
    changed: ScenarioInput,
  ) => {
    const after = measure(changed);
    const saving =
      base.cost !== null && after.cost !== null ? base.cost - after.cost : null;
    options.push({
      ...partial,
      savingEuro: saving === null ? null : Math.round(saving * 100) / 100,
      euroPerKg: { from: base.perKg, to: after.perKg },
      machineHours: { from: base.hours, to: after.hours },
      solvesCapacity:
        overCapacity && after.hours !== null && after.hours <= (available ?? 0),
    });
  };

  // 1. Seal more packs per machine cycle (double chamber or a larger chamber).
  const t = machine?.throughput;
  if (
    machine &&
    t?.method === "cycle" &&
    known(t.packagesPerCycle) &&
    known(t.cycleSeconds)
  ) {
    const next = structuredClone(end);
    const tt = next.machines[0].throughput;
    if (tt.method === "cycle")
      tt.packagesPerCycle = q(new Decimal(t.packagesPerCycle.value!).times(2));
    option(
      {
        id: "machine",
        title: "Seal twice as many packs per cycle",
        why: `A double-chamber or larger vacuum machine packs ${Number(t.packagesPerCycle.value) * 2} packs per cycle instead of ${t.packagesPerCycle.value}, halving machine time${end.labor.method === "hourly" ? " and the paid packing hours" : ""}.`,
        assumption:
          "Same cycle time with twice the packs per cycle; the machine price is not included.",
        research:
          "Which double-chamber vacuum packaging machines would suit us, what do they cost, and how fast would they pay back with our volumes?",
        testable: true,
      },
      next,
    );
  }

  // 2. Shift some of the smallest pack's share into the largest pack.
  const sized = end.formats
    .map((f, i) => ({
      i,
      grams: Number(f.portionWeightGrams.value),
      share: Number(f.allocationPercent.value),
    }))
    .filter((f) => f.grams > 0 && Number.isFinite(f.share))
    .sort((a, b) => a.grams - b.grams);
  const small = sized.at(0);
  const large = sized.at(-1);
  if (small && large && small.grams !== large.grams && small.share > 0) {
    const move = Math.min(10, small.share);
    const next = structuredClone(end);
    next.formats[small.i].allocationPercent = q(
      new Decimal(small.share).minus(move),
    );
    next.formats[large.i].allocationPercent = q(
      new Decimal(large.share).plus(move),
    );
    option(
      {
        id: "mix",
        title: `Move ${move}% of volume from ${size(small.grams)} to ${size(large.grams)} packs`,
        why: `Every pack needs its own bag, label and handling, so ${size(large.grams)} packs cost far less per kilogram than ${size(small.grams)} packs.`,
        assumption: `${move} percentage points of production move to ${size(large.grams)} packs; customers must accept it — check with the customer survey.`,
        research: `Would our customers buy ${size(large.grams)} packs instead of ${size(small.grams)} packs, and how should we price them?`,
        testable: false,
      },
      next,
    );
  }

  // 3. Negotiate a volume discount on bags and labels.
  const materialKnown = end.formats.every((f) =>
    f.materialCost.method === "combined"
      ? known(f.materialCost.combinedEuroPerPackage)
      : known(f.materialCost.bagEuroPerPackage) &&
        known(f.materialCost.labelEuroPerPackage),
  );
  if (materialKnown && end.formats.length) {
    const next = structuredClone(end);
    for (const f of next.formats) {
      const c = f.materialCost;
      f.materialCost =
        c.method === "combined"
          ? {
              ...c,
              combinedEuroPerPackage: q(
                new Decimal(c.combinedEuroPerPackage.value!).times(0.9),
              ),
            }
          : {
              ...c,
              bagEuroPerPackage: q(
                new Decimal(c.bagEuroPerPackage.value!).times(0.9),
              ),
              labelEuroPerPackage: q(
                new Decimal(c.labelEuroPerPackage.value!).times(0.9),
              ),
            };
    }
    option(
      {
        id: "material",
        title: "Negotiate 10% off bags and labels",
        why: `You would buy about ${base.packages === null ? "the same number of" : Math.round(base.packages).toLocaleString("en-US")} bags and labels a month — enough volume to ask for a tiered price or compare a second supplier.`,
        assumption: "A 10% lower price on every bag and label.",
        research:
          "Which suppliers in Latvia or the EU offer vacuum bags and labels at our volume, and what volume discounts are typical?",
        testable: true,
      },
      next,
    );
  }

  // 4. Cut packing labour by 10 % (workflow, pre-printed labels, batching).
  const labourKnown =
    end.labor.method === "perPackage"
      ? known(end.labor.euroPerPackage)
      : known(end.labor.euroPerPersonHour);
  if (labourKnown) {
    const next = structuredClone(end);
    next.labor =
      next.labor.method === "perPackage"
        ? {
            ...next.labor,
            euroPerPackage: q(
              new Decimal(next.labor.euroPerPackage.value!).times(0.9),
            ),
          }
        : {
            ...next.labor,
            euroPerPersonHour: q(
              new Decimal(next.labor.euroPerPersonHour.value!).times(0.9),
            ),
          };
    option(
      {
        id: "labour",
        title: "Make packing 10% faster per pack",
        why: "Batching by pack size, pre-printed labels and a fixed packing station cut handling time on every pack.",
        assumption: "Labour cost per pack falls by 10% at the same wage.",
        research:
          "How can a small food producer reduce manual packing time per pack without new machinery?",
        testable: true,
      },
      next,
    );
  }

  // Capacity fixes come first when packing would exceed the available hours.
  if (overCapacity && base.hours !== null && available !== null) {
    const extra = Math.ceil((base.hours - available) * 10) / 10;
    options.unshift({
      id: "capacity",
      title: `Add about ${extra.toLocaleString("en-US")} machine hours a month`,
      why: `Packing would need ${base.hours.toFixed(1)} h against your ${available} h available. An extra shift or longer days covers the gap without new equipment.`,
      assumption:
        "The machine and staff can run longer; extra wages are not included.",
      savingEuro: null,
      euroPerKg: { from: base.perKg, to: base.perKg },
      machineHours: { from: base.hours, to: base.hours },
      solvesCapacity: true,
      research: `We will need about ${extra} more packing hours a month. Is a second shift or a faster machine cheaper for us?`,
      testable: false,
    });
  }

  const rank = (o: Option) =>
    (o.solvesCapacity ? 1e9 : 0) +
    (o.savingEuro ?? 0) +
    (o.id === "machine" && overCapacity ? 1e8 : 0);
  options.sort((a, b) => rank(b) - rank(a));
  return { options, base, available, overCapacity };
}
