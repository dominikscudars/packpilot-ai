import { describe, expect, it } from "vitest";
import { calculatePackaging } from "../calculations/packaging";
import { assumed, createDemo } from "../demo/ogTofu";
import { compareScenarios } from "../optimization/compareScenarios";
const fixture = () => {
  const workspace = createDemo();
  return { workspace, scenario: workspace.baseline };
};
describe("OG TOFU reference and unit conversions", () => {
  it("matches every reference amount exactly without double-counting labor", () => {
    const { workspace, scenario } = fixture();
    const result = calculatePackaging(scenario, workspace);
    expect(result.rows.map((r) => r.packages)).toEqual([800, 300, 200]);
    expect(result).toMatchObject({
      productionKg: 1000,
      totalPackages: 1300,
      materialEuro: 91,
      laborEuro: 195,
      operatingEuro: 286,
      euroPerKg: 0.286,
    });
    expect(result.laborHours).toBeCloseTo(((1300 / 2) * 70) / 3600, 10);
  });
  it.each([500, 2000, 10000])("scales costs at %i kg", (volume) => {
    const { workspace, scenario } = fixture();
    scenario.plans[0].productionKg.value = volume;
    const result = calculatePackaging(scenario, workspace);
    expect(result.totalPackages).toBe(volume * 1.3);
    expect(result.operatingEuro).toBe((volume / 1000) * 286);
    expect(result.euroPerKg).toBe(0.286);
  });
  it("returns zero costs and hours at zero production even with missing rates", () => {
    const { workspace, scenario } = fixture();
    scenario.plans[0].productionKg.value = 0;
    scenario.labor = {
      method: "perHour",
      euroPerWorkerHour: assumed(null, ""),
    };
    scenario.plans[0].allocations[0].materialEuroPerPackage.value = null;
    workspace.machines[0].cycleSeconds.value = null;
    expect(calculatePackaging(scenario, workspace)).toMatchObject({
      totalPackages: 0,
      materialEuro: 0,
      laborEuro: 0,
      operatingEuro: 0,
      laborHours: 0,
      euroPerKg: null,
    });
  });
  it("rounds up packages independently and charges full machine cycles per format", () => {
    const { workspace, scenario } = fixture();
    scenario.plans[0].productionKg.value = 1;
    const result = calculatePackaging(scenario, workspace);
    expect(result.rows.map((r) => r.packages)).toEqual([1, 1, 1]);
    expect(result.packagedCapacityKg).toBe(1.75);
    expect(result.operatingEuro).toBe(0.66);
    expect(result.laborHours).toBeCloseTo((3 * 70) / 3600, 10);
  });
  it("does not round a decimal boundary into an extra package", () => {
    const { workspace, scenario } = fixture();
    scenario.plans[0].productionKg.value = 0.3;
    workspace.formats[0].netWeightGrams = 100;
    scenario.plans[0].allocations = [
      { ...scenario.plans[0].allocations[0], shareByWeight: assumed(1, "") },
    ];
    expect(calculatePackaging(scenario, workspace).totalPackages).toBe(3);
  });
  it("supports multiple products without changing calculation formulas", () => {
    const { workspace, scenario } = fixture();
    workspace.products.push({
      id: "second",
      companyId: "og-tofu",
      name: "Second product",
    });
    scenario.plans.push({
      ...structuredClone(scenario.plans[0]),
      productId: "second",
    });
    expect(calculatePackaging(scenario, workspace)).toMatchObject({
      totalPackages: 2600,
      operatingEuro: 572,
      euroPerKg: 0.286,
    });
  });
  it("retains fractional cents until display rather than rounding each package price", () => {
    const { workspace, scenario } = fixture();
    scenario.plans[0].allocations.forEach((a) => {
      a.materialEuroPerPackage.value = 0.07125;
    });
    expect(calculatePackaging(scenario, workspace).materialEuro).toBe(92.625);
  });
});
describe("labor modes and incomplete data", () => {
  it("uses worker-hours only in hourly mode, including staffing", () => {
    const { workspace, scenario } = fixture();
    workspace.machines[0].workers.value = 2;
    scenario.labor = { method: "perHour", euroPerWorkerHour: assumed(12, "") };
    const result = calculatePackaging(scenario, workspace);
    expect(result.laborHours).toBeCloseTo(25.2777777778, 8);
    expect(result.laborEuro).toBeCloseTo(303.3333333333, 8);
    expect(result.operatingEuro).toBeCloseTo(394.3333333333, 8);
  });
  it("does not change per-package labor cost when staffing changes", () => {
    const { workspace, scenario } = fixture();
    workspace.machines[0].workers.value = 3;
    expect(calculatePackaging(scenario, workspace).laborEuro).toBe(195);
  });
  it("supports absent supplier, dimensions, inventory and capacity inputs", () => {
    const { workspace, scenario } = fixture();
    expect(workspace.suppliers).toEqual([]);
    expect(calculatePackaging(scenario, workspace).operatingEuro).toBe(286);
  });
  it("keeps costs available but hours unknown without processing data", () => {
    const { workspace, scenario } = fixture();
    workspace.formats.forEach((f) => delete f.machineId);
    workspace.machines = [];
    expect(calculatePackaging(scenario, workspace)).toMatchObject({
      operatingEuro: 286,
      laborHours: null,
    });
  });
  it("makes hourly labor unknown without processing time", () => {
    const { workspace, scenario } = fixture();
    workspace.machines[0].cycleSeconds.value = null;
    scenario.labor = { method: "perHour", euroPerWorkerHour: assumed(12, "") };
    expect(calculatePackaging(scenario, workspace)).toMatchObject({
      materialEuro: 91,
      laborEuro: null,
      operatingEuro: null,
      euroPerKg: null,
    });
  });
  it("makes material and operating costs unknown when one material price is missing", () => {
    const { workspace, scenario } = fixture();
    scenario.plans[0].allocations[0].materialEuroPerPackage.value = null;
    expect(calculatePackaging(scenario, workspace)).toMatchObject({
      materialEuro: null,
      laborEuro: 195,
      operatingEuro: null,
      euroPerKg: null,
    });
  });
  it("does not turn missing per-package labor into zero", () => {
    const { workspace, scenario } = fixture();
    scenario.labor = {
      method: "perPackage",
      euroPerPackage: assumed(null, ""),
    };
    expect(calculatePackaging(scenario, workspace)).toMatchObject({
      laborEuro: null,
      operatingEuro: null,
    });
  });
  it("does not require prices for zero-share allocations", () => {
    const { workspace, scenario } = fixture();
    scenario.plans[0].allocations.forEach((a, i) => {
      a.shareByWeight.value = i === 0 ? 1 : 0;
      if (i) a.materialEuroPerPackage.value = null;
    });
    expect(calculatePackaging(scenario, workspace)).toMatchObject({
      totalPackages: 1000,
      operatingEuro: 220,
    });
  });
});
describe("validation", () => {
  it.each([-1, NaN, Infinity, 1e13])(
    "rejects invalid production %s",
    (value) => {
      const { workspace, scenario } = fixture();
      scenario.plans[0].productionKg.value = value;
      expect(() => calculatePackaging(scenario, workspace)).toThrow();
    },
  );
  it("requires production rather than treating missing data as zero", () => {
    const { workspace, scenario } = fixture();
    scenario.plans[0].productionKg.value = null;
    expect(() => calculatePackaging(scenario, workspace)).toThrow(/production/);
  });
  it("rejects negative prices", () => {
    const { workspace, scenario } = fixture();
    scenario.plans[0].allocations[0].materialEuroPerPackage.value = -0.1;
    expect(() => calculatePackaging(scenario, workspace)).toThrow();
  });
  it("rejects invalid mix totals", () => {
    const { workspace, scenario } = fixture();
    scenario.plans[0].allocations[0].shareByWeight.value = 0.7;
    expect(() => calculatePackaging(scenario, workspace)).toThrow(/100%/);
  });
  it("rejects missing mix shares", () => {
    const { workspace, scenario } = fixture();
    scenario.plans[0].allocations[0].shareByWeight.value = null;
    expect(() => calculatePackaging(scenario, workspace)).toThrow(/share/);
  });
  it.each([0, -1])("rejects invalid package weight %i g", (value) => {
    const { workspace, scenario } = fixture();
    workspace.formats[0].netWeightGrams = value;
    expect(() => calculatePackaging(scenario, workspace)).toThrow();
  });
  it.each([0, 1.5])(
    "rejects invalid packages per machine cycle %s",
    (value) => {
      const { workspace, scenario } = fixture();
      workspace.machines[0].packagesPerCycle.value = value;
      expect(() => calculatePackaging(scenario, workspace)).toThrow(/positive/);
    },
  );
  it("rejects duplicate allocations", () => {
    const { workspace, scenario } = fixture();
    scenario.plans[0].allocations.push(scenario.plans[0].allocations[0]);
    expect(() => calculatePackaging(scenario, workspace)).toThrow(/Duplicate/);
  });
  it("rejects dangling references", () => {
    const { workspace, scenario } = fixture();
    workspace.formats[0].machineId = "missing";
    expect(() => calculatePackaging(scenario, workspace)).toThrow(
      /machine reference/,
    );
  });
  it("rejects unsafe package counts", () => {
    const { workspace, scenario } = fixture();
    workspace.formats[0].netWeightGrams = 1e-12;
    expect(() => calculatePackaging(scenario, workspace)).toThrow(
      /safe integer/,
    );
  });
  it("does not mutate its inputs", () => {
    const { workspace, scenario } = fixture();
    const before = structuredClone(workspace);
    calculatePackaging(scenario, workspace);
    expect(workspace).toEqual(before);
  });
});
describe("scenario comparison", () => {
  it("flags unlike volumes and propagates missing costs", () => {
    const { workspace, scenario } = fixture();
    const baseline = calculatePackaging(scenario, workspace);
    scenario.plans[0].productionKg.value = 2000;
    const alternative = calculatePackaging(scenario, workspace);
    expect(compareScenarios(baseline, alternative)).toEqual({
      operatingCostDifferenceEuro: 286,
      comparableVolume: false,
    });
    expect(
      compareScenarios(baseline, { ...alternative, operatingEuro: null })
        .operatingCostDifferenceEuro,
    ).toBeNull();
  });
});
