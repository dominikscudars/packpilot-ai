import { describe, expect, it } from "vitest";
import { createDemoScenario } from "../../backend/src/domain/demo";
import { compareScenarios } from "../../backend/src/calculation-engine/comparison";
import { FRIENDLY_WARNINGS, fillRunningCosts } from "../pages/Simulator";

describe("simulator helpers", () => {
  it("has plain-English text for every warning the demo comparison raises", () => {
    const half = createDemoScenario();
    half.monthlyProductionKg = { ...half.monthlyProductionKg, value: "500" };
    const result = compareScenarios({
      baseline: createDemoScenario(),
      alternative: half,
      sameProductAndDemand: false,
    });
    expect(result.warnings.length).toBeGreaterThan(0);
    for (const w of result.warnings) expect(FRIENDLY_WARNINGS[w]).toBeDefined();
  });

  it("auto-fill unlocks net savings on the OG TOFU demo without changing packaging cost", () => {
    const base = fillRunningCosts(createDemoScenario());
    const result = compareScenarios({
      baseline: base,
      alternative: fillRunningCosts(createDemoScenario()),
      sameProductAndDemand: true,
    });
    expect(result.monthlyNetSavingsEuro).not.toBeNull();
    expect(result.warnings).not.toContain(
      "Net savings require comparable fulfilled production and complete recurring operating cost inputs.",
    );
    expect(result.baseline.totalPackagingOperatingEuro).toBe(
      compareScenarios({
        baseline: createDemoScenario(),
        alternative: createDemoScenario(),
        sameProductAndDemand: true,
      }).baseline.totalPackagingOperatingEuro,
    );
    expect(base.additionalOperatingEuroPerMonth.quality).toBe("assumption");
  });

  it("keeps known running costs", () => {
    const s = createDemoScenario();
    s.additionalOperatingEuroPerMonth = { value: "40", quality: "reported" };
    expect(fillRunningCosts(s).additionalOperatingEuroPerMonth.value).toBe(
      "40",
    );
  });
});
