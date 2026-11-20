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
/**
 * Browser storage key for the local demo. Version 3 starts empty: earlier
 * versions came prefilled with OG TOFU's figures and are never read back.
 */
export const DEMO_KEY = "packpilot.demo.v3";
/** Older demo keys, removed by "Reset demo" and otherwise ignored. */
export const LEGACY_DEMO_KEYS = ["packpilot.demo.v2"];
export const DEMO_COMPANY_ID = "demo-company";
/** Saved-scenario name that marks the one-click OG TOFU example in the demo. */
export const EXAMPLE_PROFILE = "Example pilot profile (OG TOFU)";
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
/** A new demo workspace holds no company data: the visitor enters their own. */
function initial(): { company: CompanyRecord; catalog: Catalog } {
  return {
    company: {
      id: DEMO_COMPANY_ID,
      name: "Demo company",
      country: null,
      industryCategory: null,
      membershipRole: "owner",
    },
    catalog: {
      products: [],
      materials: [],
      formats: [],
      machines: [],
      inventory: [],
      suppliers: [],
      scenarios: [],
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
