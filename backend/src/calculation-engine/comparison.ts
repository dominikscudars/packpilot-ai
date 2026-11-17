import { D, output } from "../domain/inputs.js";
import { compareSchema } from "../domain/scenario.js";
import { calculatePackaging } from "./packaging.js";
import type { z } from "zod";
function difference(b: string | null, a: string | null) {
  return {
    absolute: b === null || a === null ? null : output(new D(a).minus(b)),
    percent:
      b === null || a === null || new D(b).isZero()
        ? null
        : output(new D(a).minus(b).div(b).times(100)),
  };
}
export function compareScenarios(raw: z.input<typeof compareSchema>) {
  const input = compareSchema.parse(raw);
  const baseline = calculatePackaging(input.baseline);
  const alternative = calculatePackaging(input.alternative);
  const equalVolume = new D(baseline.monthlyProductionKg).eq(
    alternative.monthlyProductionKg,
  );
  const fulfilled =
    new D(baseline.unpackagedProductionKg).isZero() &&
    new D(alternative.unpackagedProductionKg).isZero();
  const positiveVolume = new D(baseline.monthlyProductionKg).gt(0);
  const comparable =
    equalVolume && fulfilled && positiveVolume && input.sameProductAndDemand;
  const warnings: string[] = [];
  if (!equalVolume)
    warnings.push(
      "Production volumes differ. Total expenditure changes are not savings; compare unit economics separately.",
    );
  if (!input.sameProductAndDemand)
    warnings.push(
      "Consistent product and demand assumptions have not been confirmed.",
    );
  if (!fulfilled)
    warnings.push(
      "One or both scenarios leave production unpackaged; savings and payback are not comparable.",
    );
  if (!positiveVolume)
    warnings.push(
      "Zero production does not support a demand-backed investment comparison.",
    );
  const net =
    comparable &&
    baseline.totalIncludingRecurringEuro !== null &&
    alternative.totalIncludingRecurringEuro !== null
      ? new D(baseline.totalIncludingRecurringEuro).minus(
          alternative.totalIncludingRecurringEuro,
        )
      : null;
  if (net === null)
    warnings.push(
      "Net savings require comparable fulfilled production and complete recurring operating cost inputs.",
    );
  if (net !== null && net.lte(0))
    warnings.push(
      "No positive monthly net savings; no positive payback period is calculated.",
    );
  const investment =
    alternative.investmentEuro === null
      ? null
      : new D(alternative.investmentEuro);
  return {
    baseline,
    alternative,
    comparableForSavings: comparable,
    differences: {
      monthlyProductionKg: difference(
        baseline.monthlyProductionKg,
        alternative.monthlyProductionKg,
      ),
      totalPackagingEuro: difference(
        baseline.totalPackagingOperatingEuro,
        alternative.totalPackagingOperatingEuro,
      ),
      euroPerPlannedKg: difference(
        baseline.packagingEuroPerPlannedKg,
        alternative.packagingEuroPerPlannedKg,
      ),
      machineHours: difference(baseline.machineHours, alternative.machineHours),
      personHours: difference(baseline.personHours, alternative.personHours),
      totalIncludingRecurringEuro: difference(
        baseline.totalIncludingRecurringEuro,
        alternative.totalIncludingRecurringEuro,
      ),
    },
    monthlyNetSavingsEuro: output(net),
    potentialMonthlySavingsEuro: net === null ? null : output(D.max(net, 0)),
    potentialAnnualSavingsEuro:
      net === null ? null : output(D.max(net, 0).times(12)),
    simplePaybackMonths:
      net !== null && net.gt(0) && investment !== null
        ? output(investment.div(net))
        : null,
    assumptions: [
      "Annual savings assume 12 identical months at the stated demand.",
      "Alternative investment is new cash outlay; existing baseline equipment is treated as sunk cost.",
      "Simple payback excludes financing, taxes, discounting and resale value.",
    ],
    warnings,
  };
}
