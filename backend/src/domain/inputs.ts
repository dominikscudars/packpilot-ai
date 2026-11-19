import { z } from "zod";
import { Decimal } from "decimal.js";
export const D = Decimal.clone({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
});
export const decimalString = z
  .string()
  .max(40)
  .regex(
    /^(0|[1-9]\d*)(\.\d{1,12})?$/,
    "Use a non-negative decimal string with at most 12 decimal places.",
  )
  .pipe(
    z
      .string()
      .refine((v) => new D(v).lte("1000000000"), "Maximum input is 1 billion."),
  );
export const quantity = z
  .object({
    value: decimalString.nullable(),
    quality: z.enum(["reported", "verified", "assumption", "missing"]),
    sourceNote: z.string().max(2000).optional(),
  })
  .strict()
  .refine(
    (q) => (q.value === null) === (q.quality === "missing"),
    "Null values must have missing quality; known values must not.",
  );
export const positiveQuantity = quantity.refine(
  (q) =>
    q.value === null ||
    (decimalString.safeParse(q.value).success && new D(q.value).gt(0)),
  "Value must be positive when known.",
);
export const countQuantity = quantity.refine(
  (q) =>
    q.value === null ||
    (decimalString.safeParse(q.value).success && new D(q.value).isInteger()),
  "Count must be a whole number.",
);
export const positiveCount = countQuantity.refine(
  (q) =>
    q.value === null ||
    (decimalString.safeParse(q.value).success && new D(q.value).gt(0)),
  "Count must be positive when known.",
);
export type Quantity = z.infer<typeof quantity>;
export const missing = (): Quantity => ({ value: null, quality: "missing" });
export const assumed = (value: string, sourceNote: string): Quantity => ({
  value,
  quality: "assumption",
  sourceNote,
});
export const reported = (value: string, sourceNote: string): Quantity => ({
  value,
  quality: "reported",
  sourceNote,
});
export const idSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/);
export const text = z.string().trim().min(1).max(200);
export const dateSchema = z.iso.date();
export function known(q: Quantity, name: string): Decimal {
  if (q.value === null) throw new DomainError(`${name} is required.`);
  return new D(q.value);
}
export function decimal(q: Quantity): Decimal | null {
  return q.value === null ? null : new D(q.value);
}
export function total(values: (Decimal | null)[]): Decimal | null {
  return values.some((v) => v === null)
    ? null
    : values.reduce<Decimal>((a, v) => a.plus(v!), new D(0));
}
// Decimal strings keep monetary precision through JSON transport and persistence.
export function output(value: Decimal | null): string | null {
  return value === null ? null : value.toSignificantDigits(28).toFixed();
}
export class DomainError extends Error {
  readonly statusCode = 422;
}
export function unique(ids: string[], name: string) {
  if (new Set(ids).size !== ids.length)
    throw new DomainError(`Duplicate ${name}.`);
}
