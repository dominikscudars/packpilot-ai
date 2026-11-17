import { describe, it, expect } from "vitest";
import { createDemoScenario } from "../src/domain/demo.js";
import { assumed, missing } from "../src/domain/inputs.js";
import { calculatePackaging } from "../src/calculation-engine/packaging.js";
import { compareScenarios } from "../src/calculation-engine/comparison.js";
import { scenarioInputSchema } from "../src/domain/scenario.js";
const q = (value: string) => assumed(value, "Test assumption");
function complete() {
  const s = createDemoScenario();
  s.additionalOperatingEuroPerMonth = q("0");
  s.machines[0].maintenanceEuroPerMonth = q("0");
  s.machines[0].investmentEuro = q("1000");
  return s;
}
describe("packaging engine", () => {
  it("returns exact OG TOFU quantities and money with unrounded cycle throughput", () => {
    const result = calculatePackaging(createDemoScenario());
    expect(result.rows.map((r) => r.packages)).toEqual([800, 300, 200]);
    expect(result).toMatchObject({
      totalPackages: 1300,
      totalMaterialEuro: "91",
      totalLaborEuro: "195",
      totalPackagingOperatingEuro: "286",
      packagingEuroPerPlannedKg: "0.286",
      packedProductionKg: "1000",
      unpackagedProductionKg: "0",
    });
    expect(Number(result.machineHours)).toBeCloseTo((650 * 70) / 3600, 12);
  });
  it.each(["500", "2000", "10000"])("scales to %s kg", (kg) => {
    const s = createDemoScenario();
    s.monthlyProductionKg = q(kg);
    const r = calculatePackaging(s);
    expect(Number(r.totalPackagingOperatingEuro)).toBe(
      (Number(kg) / 1000) * 286,
    );
    expect(r.packagingEuroPerPlannedKg).toBe("0.286");
  });
  it("handles zero production with missing costs and time", () => {
    const s = createDemoScenario();
    s.monthlyProductionKg = q("0");
    s.formats[0].materialCost = {
      method: "combined",
      combinedEuroPerPackage: missing(),
    };
    s.machines[0].throughput = { method: "rate", packagesPerHour: missing() };
    expect(calculatePackaging(s)).toMatchObject({
      totalPackages: 0,
      totalPackagingOperatingEuro: "0",
      machineHours: "0",
      personHours: "0",
      packagingEuroPerPlannedKg: null,
    });
  });
  it("does not substitute a missing price with zero", () => {
    const s = createDemoScenario();
    s.formats[0].materialCost = {
      method: "combined",
      combinedEuroPerPackage: missing(),
    };
    expect(calculatePackaging(s)).toMatchObject({
      totalMaterialEuro: null,
      totalLaborEuro: "195",
      totalPackagingOperatingEuro: null,
    });
  });
  it("supports separate bag and label pricing without rounding per-unit costs", () => {
    const s = createDemoScenario();
    s.formats.forEach((f) => {
      f.materialCost = {
        method: "itemized",
        bagEuroPerPackage: q("0.06125"),
        labelEuroPerPackage: q("0.01"),
      };
    });
    expect(calculatePackaging(s).totalMaterialEuro).toBe("92.625");
  });
  it("keeps a missing label price unknown in itemized mode", () => {
    const s = createDemoScenario();
    s.formats[0].materialCost = {
      method: "itemized",
      bagEuroPerPackage: q("0.06"),
      labelEuroPerPackage: missing(),
    };
    expect(calculatePackaging(s).totalMaterialEuro).toBeNull();
  });
  it("preserves mass by reallocating when floor counts obstruct exact fulfillment", () => {
    const s = createDemoScenario();
    s.monthlyProductionKg = q("0.008");
    s.formats = s.formats.slice(0, 2);
    s.formats[0].portionWeightGrams = q("6");
    s.formats[0].allocationPercent = q("75");
    s.formats[1].portionWeightGrams = q("4");
    s.formats[1].allocationPercent = q("25");
    const r = calculatePackaging(s);
    expect(r.rows.map((x) => x.packages)).toEqual([0, 2]);
    expect(r.unpackagedProductionKg).toBe("0");
    expect(r.packedProductionKg).toBe("0.008");
    expect(r.warnings.join(" ")).toMatch(/reallocation/);
  });
  it("reports impossible whole-package fulfillment without increasing production", () => {
    const s = createDemoScenario();
    s.monthlyProductionKg = q("1.1");
    const r = calculatePackaging(s);
    expect(r.packedProductionKg).toBe("1");
    expect(r.unpackagedProductionKg).toBe("0.1");
    expect(r.productionDifferenceKg).toBe("-0.1");
  });
  it("does not allocate packages to zero-share formats", () => {
    const s = createDemoScenario();
    s.monthlyProductionKg = q("0.5");
    s.formats.forEach((f, i) => {
      f.allocationPercent = q(i === 0 ? "100" : "0");
    });
    const r = calculatePackaging(s);
    expect(r.totalPackages).toBe(0);
    expect(r.unpackagedProductionKg).toBe("0.5");
  });
  it("handles an exact decimal portion boundary", () => {
    const s = createDemoScenario();
    s.monthlyProductionKg = q("0.3");
    s.formats = [
      {
        ...s.formats[0],
        portionWeightGrams: q("100"),
        allocationPercent: q("100"),
      },
    ];
    expect(calculatePackaging(s).totalPackages).toBe(3);
  });
  it("counts person-hours separately and never double-counts labor", () => {
    const s = createDemoScenario();
    s.machines[0].operators = q("2");
    expect(calculatePackaging(s).totalLaborEuro).toBe("195");
    s.labor = { method: "hourly", euroPerPersonHour: q("12") };
    const r = calculatePackaging(s);
    expect(Number(r.personHours)).toBeCloseTo(25.2777777777778, 10);
    expect(Number(r.totalLaborEuro)).toBeCloseTo(303.333333333333, 10);
  });
  it("leaves person-hours unknown without a staffing assumption", () => {
    const s = createDemoScenario();
    s.machines[0].operators = missing();
    expect(calculatePackaging(s)).toMatchObject({
      totalLaborEuro: "195",
      personHours: null,
    });
    s.labor = { method: "hourly", euroPerPersonHour: q("12") };
    expect(calculatePackaging(s).totalLaborEuro).toBeNull();
  });
  it("supports separate machines and reports utilization", () => {
    const s = createDemoScenario();
    s.machines.push({
      ...structuredClone(s.machines[0]),
      id: "second",
      throughput: { method: "rate", packagesPerHour: q("100") },
      availableHoursPerMonth: q("1"),
    });
    s.formats[0].machineId = "second";
    const r = calculatePackaging(s);
    expect(r.machineUsage.find((m) => m.machineId === "second")).toMatchObject({
      machineHours: "8",
      utilizationPercent: "800",
    });
    expect(r.warnings.join(" ")).toMatch(/exceeds/);
  });
  it.each(["-1", "NaN", "Infinity", "1e3"])(
    "rejects invalid numeric input %s",
    (value) => {
      const s = createDemoScenario();
      s.monthlyProductionKg = q(value);
      expect(() => calculatePackaging(s)).toThrow();
    },
  );
  it("rejects invalid mix totals", () => {
    const s = createDemoScenario();
    s.formats[0].allocationPercent = q("79");
    expect(() => calculatePackaging(s)).toThrow(/exactly 100/);
  });
  it("rejects missing production and zero portion weight", () => {
    const s = createDemoScenario();
    s.monthlyProductionKg = missing();
    expect(() => calculatePackaging(s)).toThrow(/required/);
    s.monthlyProductionKg = q("1");
    s.formats[0].portionWeightGrams = q("0");
    expect(() => calculatePackaging(s)).toThrow();
  });
  it("rejects missing provenance and mixed labor methods", () => {
    const s = createDemoScenario();
    expect(() =>
      scenarioInputSchema.parse({
        ...s,
        monthlyProductionKg: { value: "1", quality: "missing" },
      }),
    ).toThrow();
    expect(() =>
      scenarioInputSchema.parse({
        ...s,
        labor: {
          method: "perPackage",
          euroPerPackage: q("0.15"),
          euroPerPersonHour: q("10"),
        },
      }),
    ).toThrow();
  });
  it("rejects duplicate IDs and unknown machine references", () => {
    const s = createDemoScenario();
    s.formats[1].id = s.formats[0].id;
    expect(() => calculatePackaging(s)).toThrow(/Duplicate/);
    s.formats[1].id = "second";
    s.formats[0].machineId = "unknown";
    expect(() => calculatePackaging(s)).toThrow(/Unknown machine/);
  });
  it("retains declared fixed monthly costs at zero production", () => {
    const s = complete();
    s.monthlyProductionKg = q("0");
    s.additionalOperatingEuroPerMonth = q("5");
    s.machines[0].maintenanceEuroPerMonth = q("15");
    expect(calculatePackaging(s)).toMatchObject({
      totalPackagingOperatingEuro: "0",
      recurringOperatingEuroPerMonth: "20",
      totalIncludingRecurringEuro: "20",
    });
  });
  it("preserves production accounting across fractional-volume scenarios", () => {
    for (const volume of [
      "0.001",
      "0.25",
      "0.8",
      "1",
      "1.1",
      "1.25",
      "7.75",
      "12.2",
    ]) {
      const s = createDemoScenario();
      s.monthlyProductionKg = q(volume);
      const r = calculatePackaging(s);
      expect(
        Number(r.packedProductionKg) + Number(r.unpackagedProductionKg),
      ).toBeCloseTo(Number(volume), 12);
      expect(Number(r.packedProductionKg)).toBeLessThanOrEqual(Number(volume));
      expect(r.rows.every((row) => Number.isInteger(row.packages))).toBe(true);
    }
  });
  it("does not mutate source inputs", () => {
    const s = createDemoScenario(),
      before = structuredClone(s);
    calculatePackaging(s);
    expect(s).toEqual(before);
  });
});
describe("scenario comparison", () => {
  it("does not call lower-volume spending a saving", () => {
    const baseline = complete(),
      alternative = complete();
    alternative.monthlyProductionKg = q("500");
    const r = compareScenarios({
      baseline,
      alternative,
      sameProductAndDemand: true,
    });
    expect(r.differences.totalPackagingEuro).toEqual({
      absolute: "-143",
      percent: "-50",
    });
    expect(r.differences.euroPerPlannedKg.absolute).toBe("0");
    expect(r.potentialMonthlySavingsEuro).toBeNull();
    expect(r.simplePaybackMonths).toBeNull();
  });
  it("includes recurring maintenance in net savings and payback", () => {
    const baseline = complete(),
      alternative = complete();
    alternative.labor = { method: "perPackage", euroPerPackage: q("0.10") };
    alternative.machines[0].maintenanceEuroPerMonth = q("15");
    const r = compareScenarios({
      baseline,
      alternative,
      sameProductAndDemand: true,
    });
    expect(r.monthlyNetSavingsEuro).toBe("50");
    expect(r.potentialAnnualSavingsEuro).toBe("600");
    expect(r.simplePaybackMonths).toBe("20");
  });
  it.each(["0.15", "0.20"])(
    "returns no positive payback at labor %s",
    (rate) => {
      const baseline = complete(),
        alternative = complete();
      alternative.labor = { method: "perPackage", euroPerPackage: q(rate) };
      const r = compareScenarios({
        baseline,
        alternative,
        sameProductAndDemand: true,
      });
      expect(r.simplePaybackMonths).toBeNull();
      expect(r.potentialMonthlySavingsEuro).toBe("0");
    },
  );
  it("withholds savings for missing recurring costs or unconfirmed demand", () => {
    const baseline = createDemoScenario(),
      alternative = createDemoScenario();
    expect(
      compareScenarios({ baseline, alternative, sameProductAndDemand: true })
        .monthlyNetSavingsEuro,
    ).toBeNull();
    expect(
      compareScenarios({
        baseline: complete(),
        alternative: complete(),
        sameProductAndDemand: false,
      }).monthlyNetSavingsEuro,
    ).toBeNull();
  });
  it("does not compare investment savings on unfulfilled or zero production", () => {
    const baseline = complete(),
      alternative = complete();
    baseline.monthlyProductionKg = q("1.1");
    alternative.monthlyProductionKg = q("1.1");
    expect(
      compareScenarios({ baseline, alternative, sameProductAndDemand: true })
        .monthlyNetSavingsEuro,
    ).toBeNull();
    baseline.monthlyProductionKg = q("0");
    alternative.monthlyProductionKg = q("0");
    expect(
      compareScenarios({ baseline, alternative, sameProductAndDemand: true })
        .simplePaybackMonths,
    ).toBeNull();
  });
});
