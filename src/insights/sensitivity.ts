import { D, assumed } from "../../backend/src/domain/inputs";
import type { PackagingCostResult, ScenarioInput } from "../models/api";

type Quantity = ScenarioInput["monthlyProductionKg"];
export type DriverId = "material" | "labour" | "volume";
export interface Driver {
  id: DriverId;
  name: string;
  /** Shown when the input is Unknown: what to add. */
  needs: string;
  field: string;
}
export const DRIVERS: Driver[] = [
  {
    id: "material",
    name: "Bag and label cost",
    needs: "bag and label cost for every pack size",
    field: "costs",
  },
  {
    id: "labour",
    name: "Labour rate",
    needs: "labour cost",
    field: "labour",
  },
  {
    id: "volume",
    name: "Monthly production",
    needs: "monthly production",
    field: "production",
  },
];
export const STEP = 0.1;

const note = (factor: number) =>
  `Sensitivity test: ${factor > 1 ? "+" : "−"}${Math.round(Math.abs(factor - 1) * 100)}% of the saved value; not a forecast.`;
/** null when the value is Unknown: never treated as €0. */
function scale(q: Quantity, factor: number, places: number): Quantity | null {
  if (q.value === null) return null;
  const v = new D(q.value).times(factor).toDecimalPlaces(places).toFixed();
  return assumed(v, note(factor));
}

/** The saved scenario with one driver changed by `factor`; null if Unknown. */
export function vary(
  base: ScenarioInput,
  id: DriverId,
  factor: number,
): ScenarioInput | null {
  const next = structuredClone(base);
  if (id === "volume") {
    const kg = scale(base.monthlyProductionKg, factor, 6);
    if (!kg) return null;
    next.monthlyProductionKg = kg;
  } else if (id === "labour") {
    const l = next.labor;
    if (l.method === "hourly") {
      const rate = scale(l.euroPerPersonHour, factor, 12);
      if (!rate) return null;
      l.euroPerPersonHour = rate;
    } else {
      const rate = scale(l.euroPerPackage, factor, 12);
      if (!rate) return null;
      l.euroPerPackage = rate;
    }
  } else {
    for (const f of next.formats) {
      const c = f.materialCost;
      if (c.method === "combined") {
        const v = scale(c.combinedEuroPerPackage, factor, 12);
        if (!v) return null;
        c.combinedEuroPerPackage = v;
      } else {
        const bag = scale(c.bagEuroPerPackage, factor, 12);
        const label = scale(c.labelEuroPerPackage, factor, 12);
        if (!bag || !label) return null;
        c.bagEuroPerPackage = bag;
        c.labelEuroPerPackage = label;
      }
    }
  }
  return next;
}

export const PAYBACK_MONTHS = [12, 24, 36] as const;
export type BreakEven =
  | { status: "missing"; needs: { text: string; field: string }[] }
  | {
      status: "ready";
      investmentEuro: string;
      rows: {
        months: number;
        /** Net monthly saving (after maintenance and other running costs). */
        monthlySavingEuro: string;
        /** The same saving per kg at current production; null at zero kg. */
        savingEuroPerKg: string | null;
      }[];
    };

/**
 * Payback threshold for the recorded machine investment: the net monthly
 * saving it must deliver to pay back in 12/24/36 months (simple payback,
 * same rules as the comparison engine). Needs investment and recurring costs.
 */
export function breakEven(r: PackagingCostResult): BreakEven {
  const needs: { text: string; field: string }[] = [];
  if (r.investmentEuro === null)
    needs.push({ text: "the machine purchase price", field: "other-costs" });
  if (r.totalIncludingRecurringEuro === null)
    needs.push({
      text: "monthly maintenance and other recurring costs (0 if none)",
      field: "other-costs",
    });
  if (r.investmentEuro === null || needs.length > 0)
    return { status: "missing", needs };
  const investment = new D(r.investmentEuro);
  const kg = new D(r.monthlyProductionKg);
  return {
    status: "ready",
    investmentEuro: r.investmentEuro,
    rows: PAYBACK_MONTHS.map((months) => {
      const saving = investment.div(months);
      return {
        months,
        monthlySavingEuro: saving.toFixed(2),
        savingEuroPerKg: kg.gt(0) ? saving.div(kg).toFixed(4) : null,
      };
    }),
  };
}
