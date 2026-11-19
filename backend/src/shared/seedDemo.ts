import type { PrismaClient } from "@prisma/client";
import {
  companySchema,
  productSchema,
  materialSchema,
  formatSchema,
  machineSchema,
  inventoryRecordSchema,
} from "../domain/entities.js";
import { reported, missing } from "../domain/inputs.js";
import { createDemoScenario } from "../domain/demo.js";
/** Idempotent, non-destructive seed: existing edits are never overwritten. */
export async function seedDemo(db: PrismaClient) {
  const input = createDemoScenario();
  const companyId = "og-tofu";
  await db.$transaction(async (tx) => {
    await tx.company.upsert({
      where: { id: companyId },
      update: {},
      create: {
        id: companyId,
        ...companySchema.parse({
          name: "OG TOFU",
          industryCategory: "Plant-based food manufacturing",
          country: "Latvia",
        }),
      },
    });
    await tx.product.upsert({
      where: { id: "og-fresh-tofu" },
      update: {},
      create: {
        id: "og-fresh-tofu",
        companyId,
        ...productSchema.parse({
          name: "Fresh tofu",
          category: "Plant-based food",
          storageRequirements:
            "Reported refrigeration at approximately +2°C to +6°C.",
          shelfLifeDays: reported(
            "10",
            "Approximate current reported shelf life; not independently validated.",
          ),
          shelfLifeNote:
            "No shelf-life or food safety certification is implied.",
        }),
      },
    });
    await tx.packagingMaterial.upsert({
      where: { id: "og-pape" },
      update: {},
      create: {
        id: "og-pape",
        companyId,
        ...materialSchema.parse({
          name: "PA/PE vacuum packaging",
          structure: "PA/PE",
          unitCostEuroPerPackage: missing(),
          foodContactDocumentationStatus: "unknown",
          validationStatus: "unvalidated",
        }),
      },
    });
    const machine = input.machines[0];
    await tx.packagingMachine.upsert({
      where: { id: machine.id },
      update: {},
      create: {
        id: machine.id,
        companyId,
        ...machineSchema.parse({
          model: "HURAKAN VAC 400",
          throughput: machine.throughput,
          operators: machine.operators,
        }),
      },
    });
    for (const f of input.formats) {
      await tx.packagingFormat.upsert({
        where: { id: f.id },
        update: {},
        create: {
          id: f.id,
          companyId,
          ...formatSchema.parse({
            productId: "og-fresh-tofu",
            materialId: "og-pape",
            portionWeightGrams: f.portionWeightGrams,
            materialCost: f.materialCost,
            commercialStatus: "illustrative",
            dataQualityStatus: "assumption",
          }),
        },
      });
    }
    await tx.packagingInventory.upsert({
      where: { id: "og-stock-pape" },
      update: {},
      create: {
        id: "og-stock-pape",
        companyId,
        ...inventoryRecordSchema.parse({ materialId: "og-pape" }),
      },
    });
    if (
      !(await tx.productionScenario.findUnique({
        where: { id: "og-demo-scenario" },
      }))
    )
      await tx.productionScenario.create({
        data: {
          id: "og-demo-scenario",
          companyId,
          name: "Illustrative OG TOFU reference",
          kind: "modeled",
          input,
          allocations: {
            create: input.formats.map((f) => ({ formatId: f.id })),
          },
          machines: {
            create: input.machines.map((m) => ({ machineId: m.id })),
          },
        },
      });
  });
  return { companyId, scenarioId: "og-demo-scenario" };
}
