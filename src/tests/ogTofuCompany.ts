import {
  productSchema,
  materialSchema,
  formatSchema,
  machineSchema,
  inventoryRecordSchema,
} from "../../backend/src/domain/entities";
import { reported } from "../../backend/src/domain/inputs";
import { createDemoScenario } from "../../backend/src/domain/demo";
import type { Catalog, CompanyRecord } from "../models/api";

/**
 * Test-only: a company that already has OG TOFU's reference data saved, as a
 * signed-in company with existing records would. The app's own demo starts
 * empty and never contains this data.
 */
export function ogTofuStore(): { company: CompanyRecord; catalog: Catalog } {
  const companyId = "og-tofu";
  const input = createDemoScenario();
  return {
    company: {
      id: companyId,
      name: "OG TOFU",
      country: "Latvia",
      industryCategory: "Plant-based food manufacturing",
      membershipRole: "owner",
    },
    catalog: {
      products: [
        {
          id: "og-fresh-tofu",
          companyId,
          ...productSchema.parse({
            name: "Fresh tofu",
            shelfLifeDays: reported(
              "10",
              "Approximate reported shelf life; not independently validated.",
            ),
            shelfLifeNote:
              "No shelf-life or food safety certification is implied.",
            storageRequirements:
              "Reported refrigeration at approximately +2°C to +6°C.",
          }),
        },
      ],
      materials: [
        {
          id: "og-pape",
          companyId,
          ...materialSchema.parse({
            name: "PA/PE vacuum packaging",
            structure: "PA/PE",
          }),
        },
      ],
      machines: input.machines.map(({ id, ...m }) => ({
        id,
        companyId,
        ...machineSchema.parse({ ...m, model: "HURAKAN VAC 400" }),
      })),
      formats: input.formats.map((f) => ({
        id: f.id,
        companyId,
        ...formatSchema.parse({
          productId: "og-fresh-tofu",
          materialId: "og-pape",
          portionWeightGrams: f.portionWeightGrams,
          materialCost: f.materialCost,
          commercialStatus: "illustrative",
        }),
      })),
      inventory: [
        {
          id: "og-stock-pape",
          companyId,
          ...inventoryRecordSchema.parse({ materialId: "og-pape" }),
        },
      ],
      suppliers: [],
      scenarios: [
        {
          id: "og-demo-scenario",
          companyId,
          name: "Illustrative OG TOFU reference",
          kind: "modeled",
          input,
        },
      ],
    },
  };
}
