import { z } from "zod";
import {
  companySchema,
  productSchema,
  materialSchema,
  formatSchema,
  machineSchema,
  inventoryRecordSchema,
  supplierSchema,
} from "../../backend/src/domain/entities";
import { savedScenarioSchema } from "../../backend/src/domain/scenario";
import { reported } from "../../backend/src/domain/inputs";
import { createDemoScenario } from "../../backend/src/domain/demo";
import { calculatePackaging } from "../../backend/src/calculation-engine/packaging";
import { compareScenarios } from "../../backend/src/calculation-engine/comparison";
import { planInventory } from "../../backend/src/calculation-engine/inventory";
import type {
  Catalog,
  CompanyRecord,
  Gateway,
  RecordOf,
  Resources,
} from "../models/api";
export const DEMO_KEY = "packpilot.demo.v2";
/** Name of the built-in example scenario a visitor has not replaced yet. */
export const DEMO_REFERENCE_NAME = "Illustrative OG TOFU reference";
const metadata = { id: z.string(), companyId: z.string() };
const schemas = {
  products: productSchema,
  materials: materialSchema,
  formats: formatSchema,
  machines: machineSchema,
  inventory: inventoryRecordSchema,
  suppliers: supplierSchema,
  scenarios: savedScenarioSchema,
};
const storeSchema = z.object({
  company: companySchema.extend({
    id: z.string(),
    membershipRole: z.literal("owner"),
  }),
  catalog: z.object({
    products: productSchema.extend(metadata).array(),
    materials: materialSchema.extend(metadata).array(),
    formats: formatSchema.extend(metadata).array(),
    machines: machineSchema.extend(metadata).array(),
    inventory: inventoryRecordSchema.extend(metadata).array(),
    suppliers: supplierSchema.extend(metadata).array(),
    scenarios: savedScenarioSchema.extend(metadata).array(),
  }),
});
function initial(): { company: CompanyRecord; catalog: Catalog } {
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
          name: DEMO_REFERENCE_NAME,
          kind: "modeled",
          input,
        },
      ],
    },
  };
}
/** This store never reads the legacy browser profile and has no network capability. */
export function createDemoGateway(
  storage: Pick<Storage, "getItem" | "setItem">,
  notice: (message: string) => void,
): Gateway {
  let state = initial();
  try {
    const saved = storage.getItem(DEMO_KEY);
    if (saved) state = storeSchema.parse(JSON.parse(saved));
  } catch {
    notice(
      "Saved demo could not be read. Showing a fresh demo; the previous browser record has not been uploaded.",
    );
  }
  function persist() {
    try {
      storage.setItem(DEMO_KEY, JSON.stringify(state));
    } catch {
      notice(
        "Browser storage is unavailable. Demo changes will last only for this visit.",
      );
    }
  }
  const clone = <T>(value: T): T => structuredClone(value);
  function company(id: string) {
    if (id !== state.company.id) throw new Error("Demo company not found.");
  }
  return {
    async companies() {
      return [clone(state.company)];
    },
    async createCompany() {
      throw new Error("Sign in to create a company.");
    },
    async saveCompany(id, value) {
      company(id);
      state.company = { ...state.company, ...companySchema.parse(value) };
      persist();
      return clone(state.company);
    },
    async list(id, resource) {
      company(id);
      return clone(state.catalog[resource]);
    },
    async save<K extends keyof Resources>(
      id: string,
      resource: K,
      recordId: string | null,
      value: Resources[K],
    ): Promise<RecordOf<Resources[K]>> {
      company(id);
      const parsed = schemas[resource].parse(value) as Resources[K];
      if (resource === "scenarios")
        calculatePackaging(savedScenarioSchema.parse(value).input);
      const record = {
        ...parsed,
        id: recordId || crypto.randomUUID(),
        companyId: id,
      };
      // The key and value share K; TypeScript cannot retain that correlation on indexed writes.
      const records = state.catalog[resource] as RecordOf<Resources[K]>[];
      const index = records.findIndex((r) => r.id === record.id);
      if (recordId && index < 0) throw new Error("Demo record not found.");
      if (index < 0) records.push(record);
      else records[index] = record;
      persist();
      return clone(record);
    },
    async calculate(input) {
      return calculatePackaging(input);
    },
    async compare(baseline, alternative, sameProductAndDemand) {
      return compareScenarios({ baseline, alternative, sameProductAndDemand });
    },
    async inventory(input) {
      return planInventory(input);
    },
  };
}
