import { z } from "zod";
import {
  text,
  idSchema,
  quantity,
  positiveQuantity,
  countQuantity,
  missing,
} from "./inputs.js";
import { throughputSchema, materialCostSchema } from "./scenario.js";
const optionalNote = z.string().max(5000).nullable().default(null);
export const companySchema = z
  .object({
    name: text,
    industryCategory: text.nullable().default(null),
    country: text.nullable().default(null),
  })
  .strict();
export const productSchema = z
  .object({
    name: text,
    category: text.nullable().default(null),
    storageRequirements: optionalNote,
    shelfLifeDays: quantity.default(missing),
    shelfLifeNote: optionalNote,
    lengthMm: positiveQuantity.default(missing),
    widthMm: positiveQuantity.default(missing),
    heightMm: positiveQuantity.default(missing),
  })
  .strict();
export const supplierSchema = z
  .object({
    name: text,
    contactInformation: optionalNote,
    leadTimeCalendarDays: countQuantity.default(missing),
    minimumOrderPackages: countQuantity.default(missing),
    quotations: optionalNote,
  })
  .strict();
export const materialSchema = z
  .object({
    name: text,
    structure: text.nullable().default(null),
    supplierId: idSchema.nullable().default(null),
    unitCostEuroPerPackage: quantity.default(missing),
    technicalSpecifications: optionalNote,
    foodContactDocumentationStatus: z
      .enum(["unknown", "provided", "reviewed"])
      .default("unknown"),
    validationStatus: z
      .enum(["unvalidated", "reported", "verified"])
      .default("unvalidated"),
  })
  .strict();
export const formatSchema = z
  .object({
    productId: idSchema,
    materialId: idSchema,
    portionWeightGrams: positiveQuantity,
    lengthMm: positiveQuantity.default(missing),
    widthMm: positiveQuantity.default(missing),
    heightMm: positiveQuantity.default(missing),
    materialCost: materialCostSchema,
    commercialStatus: z
      .enum(["unknown", "illustrative", "active"])
      .default("unknown"),
    dataQualityStatus: z
      .enum(["reported", "verified", "assumption"])
      .default("assumption"),
  })
  .strict();
export const machineSchema = z
  .object({
    model: text,
    throughput: throughputSchema,
    operators: countQuantity.refine(
      (q) => q.value === null || Number(q.value) > 0,
      "Operators must be positive.",
    ),
    investmentEuro: quantity.default(missing),
    maintenanceEuroPerMonth: quantity.default(missing),
    availableHoursPerMonth: positiveQuantity.default(missing),
    dataQualityStatus: z
      .enum(["reported", "verified", "assumption"])
      .default("reported"),
  })
  .strict();
export const inventoryRecordSchema = z
  .object({
    formatId: idSchema.nullable().default(null),
    materialId: idSchema.nullable().default(null),
    currentStockPackages: countQuantity.default(missing),
    packagesPerProductionKg: quantity.default(missing),
    supplierLeadTimeCalendarDays: countQuantity.default(missing),
    minimumOrderPackages: countQuantity.default(missing),
    safetyStockPackages: countQuantity.default(missing),
  })
  .strict();
export type Company = z.infer<typeof companySchema>;
export type Product = z.infer<typeof productSchema>;
export type PackagingFormat = z.infer<typeof formatSchema>;
export type PackagingMaterial = z.infer<typeof materialSchema>;
export type PackagingMachine = z.infer<typeof machineSchema>;
export type Supplier = z.infer<typeof supplierSchema>;
export type PackagingInventory = z.infer<typeof inventoryRecordSchema>;
