import { Decimal } from "decimal.js";
import type { PackagingCostResult } from "../models/api";

const D = Decimal.clone({ precision: 40 });

/** One supplier quote; numbers are validated decimal strings (0 or more). */
export interface SupplierQuote {
  name: string;
  euroPerPackage: string;
  minimumOrderPackages: string;
  leadTimeDays: string;
  /** One-off setup or plate fee; null when the quote has none. */
  setupFeeEuro: string | null;
}

export interface QuoteResult {
  name: string;
  euroPerPackage: string;
  leadTimeDays: string;
  setupFeeEuro: string | null;
  monthlyMaterialEuro: string;
  /** Material cost per kg produced; null at zero production. */
  materialEuroPerKg: string | null;
  /** Quote minus current material cost; null when the current cost is Unknown. */
  differenceEuroPerMonth: string | null;
  minimumOrderPackages: string;
  /** Months of use one minimum order covers; null at zero packs. */
  minimumOrderMonths: string | null;
  /** Cash for the first minimum order, setup fee included. */
  firstOrderEuro: string;
  /** Months of saving to recover the setup fee; null if no fee or no saving. */
  setupPaybackMonths: string | null;
}

/**
 * Deterministic material-only comparison: each quote's price applies to every
 * pack the saved data needs per month (the engine's package counts, unchanged).
 * Labour, machine and other costs are identical across quotes and excluded.
 * The current material cost stays Unknown when any pack size lacks a price.
 */
export function compareQuotes(
  baseline: Pick<
    PackagingCostResult,
    "totalPackages" | "monthlyProductionKg" | "totalMaterialEuro"
  >,
  quotes: SupplierQuote[],
): { currentMaterialEuroPerKg: string | null; quotes: QuoteResult[] } {
  const packs = new D(baseline.totalPackages);
  const kg = new D(baseline.monthlyProductionKg);
  const current =
    baseline.totalMaterialEuro === null
      ? null
      : new D(baseline.totalMaterialEuro);
  const perKg = (v: Decimal) => (kg.gt(0) ? v.div(kg).toFixed(4) : null);
  return {
    currentMaterialEuroPerKg: current && perKg(current),
    quotes: quotes.map((q) => {
      const price = new D(q.euroPerPackage);
      const moq = new D(q.minimumOrderPackages);
      const fee = q.setupFeeEuro === null ? null : new D(q.setupFeeEuro);
      const monthly = price.times(packs);
      const difference = current && monthly.minus(current);
      return {
        name: q.name,
        euroPerPackage: q.euroPerPackage,
        leadTimeDays: q.leadTimeDays,
        setupFeeEuro: q.setupFeeEuro,
        monthlyMaterialEuro: monthly.toFixed(2),
        materialEuroPerKg: perKg(monthly),
        differenceEuroPerMonth: difference && difference.toFixed(2),
        minimumOrderPackages: q.minimumOrderPackages,
        minimumOrderMonths: packs.gt(0) ? moq.div(packs).toFixed(1) : null,
        firstOrderEuro: moq
          .times(price)
          .plus(fee ?? 0)
          .toFixed(2),
        setupPaybackMonths:
          fee?.gt(0) && difference?.lt(0)
            ? fee.div(difference.negated()).toFixed(1)
            : null,
      };
    }),
  };
}
