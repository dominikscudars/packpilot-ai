import type { PackagingCostResult } from "../models/types";
/** Absolute monthly cost difference, not an investment return or recommendation. */
export function compareScenarios(
  baseline: PackagingCostResult,
  alternative: PackagingCostResult,
) {
  return {
    operatingCostDifferenceEuro:
      baseline.operatingEuro === null || alternative.operatingEuro === null
        ? null
        : alternative.operatingEuro - baseline.operatingEuro,
    comparableVolume: baseline.productionKg === alternative.productionKg,
  };
}
