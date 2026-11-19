import { z } from "zod";
import {
  quantity,
  countQuantity,
  positiveCount,
  dateSchema,
  missing,
} from "./inputs.js";
export const inventoryPlanSchema = z
  .object({
    currentStockPackages: countQuantity,
    expectedMonthlyConsumptionPackages: quantity,
    calendarDaysInPlanningMonth: positiveCount,
    workingDaysInPlanningMonth: positiveCount,
    leadTimeCalendarDays: countQuantity,
    minimumOrderPackages: countQuantity,
    safetyStockPackages: countQuantity,
    reviewPeriodCalendarDays: countQuantity.default(missing),
    asOfDate: dateSchema.optional(),
    outstandingPurchaseOrders: z
      .array(
        z
          .object({ quantityPackages: countQuantity, dueDate: dateSchema })
          .strict(),
      )
      .max(100)
      .nullable()
      .default(null),
  })
  .strict();
export type InventoryPlanInput = z.infer<typeof inventoryPlanSchema>;
