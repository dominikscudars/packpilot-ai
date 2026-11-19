import { z } from "zod";
import {
  D,
  idSchema,
  text,
  quantity,
  decimalString,
  positiveQuantity,
  positiveCount,
  missing,
} from "./inputs.js";
export const materialCostSchema = z.discriminatedUnion("method", [
  z
    .object({ method: z.literal("combined"), combinedEuroPerPackage: quantity })
    .strict(),
  z
    .object({
      method: z.literal("itemized"),
      bagEuroPerPackage: quantity,
      labelEuroPerPackage: quantity,
    })
    .strict(),
]);
export const throughputSchema = z.discriminatedUnion("method", [
  z
    .object({
      method: z.literal("cycle"),
      packagesPerCycle: positiveCount,
      cycleSeconds: positiveQuantity,
    })
    .strict(),
  z
    .object({ method: z.literal("rate"), packagesPerHour: positiveQuantity })
    .strict(),
]);
export const machineConfigSchema = z
  .object({
    id: idSchema,
    throughput: throughputSchema,
    operators: positiveCount,
    investmentEuro: quantity.default(missing),
    maintenanceEuroPerMonth: quantity.default(missing),
    availableHoursPerMonth: positiveQuantity.default(missing),
  })
  .strict();
export const scenarioInputSchema = z
  .object({
    monthlyProductionKg: quantity.refine(
      (q) =>
        q.value === null ||
        (decimalString.safeParse(q.value).success &&
          new D(q.value).decimalPlaces() <= 6),
      "Production supports up to six decimal places in kg.",
    ),
    formats: z
      .array(
        z
          .object({
            id: idSchema,
            portionWeightGrams: positiveQuantity.refine(
              (q) =>
                q.value === null ||
                (decimalString.safeParse(q.value).success &&
                  new D(q.value).decimalPlaces() <= 3),
              "Portion weight supports up to three decimal places in grams.",
            ),
            allocationPercent: quantity.refine(
              (q) =>
                q.value === null ||
                (decimalString.safeParse(q.value).success &&
                  new D(q.value).lte(100)),
              "Allocation must be at most 100%.",
            ),
            materialCost: materialCostSchema,
            machineId: idSchema.nullable(),
          })
          .strict(),
      )
      .min(1)
      .max(20),
    machines: z.array(machineConfigSchema).max(20),
    labor: z.discriminatedUnion("method", [
      z
        .object({ method: z.literal("perPackage"), euroPerPackage: quantity })
        .strict(),
      z
        .object({ method: z.literal("hourly"), euroPerPersonHour: quantity })
        .strict(),
    ]),
    additionalOperatingEuroPerMonth: quantity.default(missing),
  })
  .strict();
export const savedScenarioSchema = z
  .object({
    name: text,
    kind: z.enum(["reportedBaseline", "modeled"]),
    input: scenarioInputSchema,
  })
  .strict();
export const compareSchema = z
  .object({
    baseline: scenarioInputSchema,
    alternative: scenarioInputSchema,
    sameProductAndDemand: z.boolean(),
  })
  .strict();
export type ScenarioInput = z.infer<typeof scenarioInputSchema>;
export type ProductionScenario = z.infer<typeof savedScenarioSchema>;
export type MachineConfiguration = z.infer<typeof machineConfigSchema>;
