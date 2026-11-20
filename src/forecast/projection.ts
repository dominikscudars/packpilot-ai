import { Decimal } from "decimal.js";
import type { Quantity, ScenarioInput } from "../models/api";
import { calculatePackaging } from "../../backend/src/calculation-engine/packaging";
import { parseTable } from "../survey/tabulate";
import { buildForecast } from "./forecast";

/**
 * Future forecasting. Two honest sources only:
 * - a projection from the user's explicit assumptions (never a prediction),
 * - a straight-line trend from the user's own sales history.
 * Every cost figure comes from the deterministic packaging engine.
 */
export interface Assumptions {
  /** Change in monthly production by the end of the horizon, in percent. */
  productionChangePct: number;
  /** Change in bag and label prices by the end of the horizon, in percent. */
  materialChangePct: number;
  /** Change in labour cost (per pack or per hour), in percent. */
  labourChangePct: number;
  months: number;
}
export const NO_CHANGE: Assumptions = {
  productionChangePct: 0,
  materialChangePct: 0,
  labourChangePct: 0,
  months: 12,
};

export interface Point {
  label: string;
  /** Months from now (negative for history). */
  offset: number;
  kind: "actual" | "projected";
  productionKg: number | null;
  costEuro: number | null;
  euroPerKg: number | null;
  machineHours: number | null;
}

const NOTE = "Forecast assumption; not a prediction.";

function scale(q: Quantity, factor: Decimal): Quantity {
  if (q.value === null || factor.eq(1)) return q;
  return {
    value: new Decimal(q.value).times(factor).toDecimalPlaces(6).toString(),
    quality: "assumption",
    sourceNote: NOTE,
  };
}
const set = (kg: number): Quantity => ({
  value: String(Math.max(0, Math.round(kg))),
  quality: "assumption",
  sourceNote: NOTE,
});

/** The saved inputs with production and prices changed by the given factors. */
export function adjusted(
  input: ScenarioInput,
  production: Decimal,
  material: Decimal,
  labour: Decimal,
  productionKg?: number,
): ScenarioInput {
  const next = structuredClone(input);
  next.monthlyProductionKg =
    productionKg !== undefined
      ? set(productionKg)
      : scale(next.monthlyProductionKg, production);
  for (const f of next.formats) {
    const c = f.materialCost;
    f.materialCost =
      c.method === "combined"
        ? {
            ...c,
            combinedEuroPerPackage: scale(c.combinedEuroPerPackage, material),
          }
        : {
            ...c,
            bagEuroPerPackage: scale(c.bagEuroPerPackage, material),
            labelEuroPerPackage: scale(c.labelEuroPerPackage, material),
          };
  }
  next.labor =
    next.labor.method === "perPackage"
      ? {
          ...next.labor,
          euroPerPackage: scale(next.labor.euroPerPackage, labour),
        }
      : {
          ...next.labor,
          euroPerPersonHour: scale(next.labor.euroPerPersonHour, labour),
        };
  return next;
}

const num = (v: string | null) => (v === null ? null : Number(v));

function point(
  input: ScenarioInput,
  label: string,
  offset: number,
  kind: Point["kind"],
): Point {
  const r = calculatePackaging(input);
  return {
    label,
    offset,
    kind,
    productionKg: num(input.monthlyProductionKg.value),
    costEuro: num(r.totalPackagingOperatingEuro),
    euroPerKg: num(r.packagingEuroPerPlannedKg),
    machineHours: num(r.machineHours),
  };
}

/** Calendar label for a month offset from `start` ("Nov 26"). */
export function monthLabel(start: Date, offset: number): string {
  const d = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + offset, 1),
  );
  return d.toLocaleString("en-GB", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  });
}

/** Month-by-month projection: assumptions ramp in linearly over the horizon. */
export function project(
  input: ScenarioInput,
  a: Assumptions,
  start = new Date(),
): Point[] {
  const out: Point[] = [];
  for (let m = 0; m <= a.months; m++) {
    const t = new Decimal(m).div(a.months);
    const f = (pct: number) =>
      new Decimal(1).plus(new Decimal(pct).div(100).times(t));
    out.push(
      point(
        adjusted(
          input,
          f(a.productionChangePct),
          f(a.materialChangePct),
          f(a.labourChangePct),
        ),
        m === 0 ? "Now" : monthLabel(start, m),
        m,
        m === 0 ? "actual" : "projected",
      ),
    );
  }
  return out;
}

/** The saved inputs as they would be at the end of the projection horizon. */
export function scenarioAtEnd(input: ScenarioInput, a: Assumptions) {
  const f = (pct: number) => new Decimal(1).plus(new Decimal(pct).div(100));
  return adjusted(
    input,
    f(a.productionChangePct),
    f(a.materialChangePct),
    f(a.labourChangePct),
  );
}

/** First projected month whose machine-hours exceed the available hours. */
export function capacityLimit(input: ScenarioInput, points: Point[]) {
  const available = num(
    input.machines[0]?.availableHoursPerMonth.value ?? null,
  );
  if (available === null) return { available: null, first: null };
  const first =
    points.find((p) => p.machineHours !== null && p.machineHours > available) ??
    null;
  return { available, first };
}

/** Saved sales history (pasted table) for one workspace scope. */
export interface SalesHistory {
  version: 1;
  unit: "packs" | "kg";
  table: string;
  savedAt: string;
}

/**
 * Actual monthly production from the history, then a straight-line trend for
 * the next months with costs at today's prices and pack mix. Returns null if
 * fewer than three months match the saved pack sizes.
 */
export function fromHistory(
  input: ScenarioInput,
  history: SalesHistory,
  months = 6,
) {
  const formats = input.formats
    .map((f) => ({ id: f.id, grams: Number(f.portionWeightGrams.value) }))
    .filter((f) => f.grams > 0);
  const result = buildForecast(
    parseTable(history.table),
    formats,
    history.unit,
    months,
  );
  if (result.history.length < 3) return null;
  const one = new Decimal(1);
  const points: Point[] = result.history.map((r, i) => ({
    label: r.label,
    offset: i - result.history.length + 1,
    kind: "actual",
    productionKg: Math.round(r.totalKg),
    // Past costs are not known: only today's prices are entered.
    costEuro: null,
    euroPerKg: null,
    machineHours: null,
  }));
  const lastKg = result.forecast.at(-1)?.totalKg;
  const endInput =
    lastKg === undefined ? input : adjusted(input, one, one, one, lastKg);
  for (const [i, f] of result.forecast.entries())
    points.push(
      point(
        adjusted(input, one, one, one, f.totalKg),
        f.label,
        i + 1,
        "projected",
      ),
    );
  return {
    points,
    trendKgPerMonth: result.trendKgPerMonth,
    months: result.history.length,
    /** The inputs at the last forecast month, for optimisation options. */
    endInput,
  };
}
