import { D, DomainError } from "../domain/inputs.js";
import type { Decimal } from "decimal.js";
const MAX_STATES = 200_000;
function gcd(a: number, b: number): number {
  while (b) [a, b] = [b, a % b];
  return a;
}
/** Exact integer-milligram apportionment; never manufactures extra production. */
export function allocateMass(
  productionKg: Decimal,
  formats: { grams: Decimal; percent: Decimal }[],
) {
  const massMg = productionKg.times(1_000_000).toNumber();
  const weights = formats.map((f) => f.grams.times(1000).toNumber());
  const targets = formats.map((f) =>
    productionKg.times(1000).times(f.percent).div(100),
  );
  const counts = targets.map((target, i) =>
    target.div(formats[i].grams).floor().toNumber(),
  );
  if (
    !Number.isSafeInteger(massMg) ||
    weights.some((w) => !Number.isSafeInteger(w) || w <= 0)
  )
    throw new DomainError(
      "Mass exceeds the supported integer-milligram range.",
    );
  const active = formats
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => f.percent.gt(0))
    .sort(
      (a, b) =>
        targets[b.i]
          .div(b.f.grams)
          .mod(1)
          .cmp(targets[a.i].div(a.f.grams).mod(1)) || a.i - b.i,
    )
    .map(({ i }) => i);
  const divisor = active.reduce((g, i) => gcd(g, weights[i]), 0);
  const packed = (values: number[]) =>
    values.reduce((sum, n, i) => sum + n * weights[i], 0);
  const remainder = massMg - packed(counts);
  function solve(limitMg: number): { counts: number[]; filledMg: number } {
    const limit = Math.floor(limitMg / divisor);
    if (limit > MAX_STATES)
      throw new DomainError(
        "Allocation needs more than 200,000 search states. Use a coarser weight resolution or smaller production volume.",
      );
    const parent = new Int32Array(limit + 1).fill(-1);
    parent[0] = -2;
    for (let amount = 1; amount <= limit; amount++)
      for (const i of active) {
        const step = weights[i] / divisor;
        if (step <= amount && parent[amount - step] !== -1) {
          parent[amount] = i;
          break;
        }
      }
    let best = limit;
    while (best > 0 && parent[best] === -1) best--;
    const result = weights.map(() => 0);
    let cursor = best;
    while (cursor > 0) {
      const i = parent[cursor];
      result[i]++;
      cursor -= weights[i] / divisor;
    }
    return { counts: result, filledMg: best * divisor };
  }
  let finalCounts = counts;
  let reallocated = false;
  if (remainder > 0) {
    const additions = solve(remainder);
    finalCounts = counts.map((n, i) => n + additions.counts[i]);
    // If retaining all floor counts prevents exact fulfillment, solve total mass.
    if (additions.filledMg !== remainder && massMg % divisor === 0) {
      const full = solve(massMg);
      if (full.filledMg === massMg) {
        finalCounts = full.counts;
        reallocated = true;
      }
    }
  }
  if (finalCounts.some((n) => !Number.isSafeInteger(n)))
    throw new DomainError("Unsafe package count.");
  const actualMg = packed(finalCounts);
  return {
    counts: finalCounts,
    targetsGrams: targets,
    packedKg: new D(actualMg).div(1_000_000),
    unpackagedKg: new D(massMg - actualMg).div(1_000_000),
    reallocated,
  };
}
