import { z } from "zod";
import type {
  Workspace,
  ProductionScenario,
  CalculationCatalog,
} from "./types";
const nonnegative = z.number().finite().min(0).max(1e12);
export const inputSchema = z.object({
  value: nonnegative.nullable(),
  source: z.enum(["reported", "assumption"]),
  note: z.string(),
});
const id = z.string().min(1);
const company = z.object({
  id,
  name: id,
  country: z.string().optional(),
  notes: z.string().optional(),
});
const product = z.object({
  id,
  companyId: id,
  name: id,
  category: z.string().optional(),
  storage: z.string().optional(),
  shelfLifeDays: inputSchema.optional(),
});
const format = z.object({
  id,
  name: id,
  netWeightGrams: nonnegative.positive(),
  materialId: id,
  machineId: id.optional(),
});
const material = z.object({
  id,
  name: id,
  supplierId: id.optional(),
  widthMm: inputSchema.optional(),
  heightMm: inputSchema.optional(),
});
const machine = z.object({
  id,
  name: id,
  packagesPerCycle: inputSchema,
  cycleSeconds: inputSchema,
  workers: inputSchema,
  availableHoursPerMonth: inputSchema.optional(),
});
const supplier = z.object({
  id,
  name: id,
  leadTimeDays: inputSchema.optional(),
  minimumOrderPackages: inputSchema.optional(),
});
const inventory = z.object({
  id,
  materialId: id,
  onHandPackages: inputSchema,
  safetyStockPackages: inputSchema.optional(),
  recordedOn: z.string().optional(),
});
export const scenarioSchema: z.ZodType<ProductionScenario> = z.object({
  id,
  name: id,
  plans: z
    .array(
      z.object({
        productId: id,
        productionKg: inputSchema,
        allocations: z
          .array(
            z.object({
              formatId: id,
              shareByWeight: inputSchema,
              materialEuroPerPackage: inputSchema,
            }),
          )
          .min(1),
      }),
    )
    .min(1),
  labor: z.discriminatedUnion("method", [
    z.object({ method: z.literal("perPackage"), euroPerPackage: inputSchema }),
    z.object({ method: z.literal("perHour"), euroPerWorkerHour: inputSchema }),
  ]),
});
export const catalogSchema: z.ZodType<CalculationCatalog> = z.object({
  products: z.array(product),
  formats: z.array(format),
  materials: z.array(material),
  machines: z.array(machine),
});
export const workspaceSchema: z.ZodType<Workspace> = z.object({
  version: z.literal(1),
  company,
  products: z.array(product),
  formats: z.array(format),
  materials: z.array(material),
  machines: z.array(machine),
  suppliers: z.array(supplier),
  inventory: z.array(inventory),
  baseline: scenarioSchema,
  alternative: scenarioSchema,
});
