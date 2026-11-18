import type {
  Company,
  Product,
  PackagingFormat,
  PackagingMaterial,
  PackagingMachine,
  PackagingInventory,
  Supplier,
} from "../../backend/src/domain/entities";
import type {
  ProductionScenario,
  ScenarioInput,
} from "../../backend/src/domain/scenario";
import type { InventoryPlanInput } from "../../backend/src/domain/inventory";
import type { PackagingCostResult } from "../../backend/src/calculation-engine/packaging";
import type { compareScenarios } from "../../backend/src/calculation-engine/comparison";
import type { planInventory } from "../../backend/src/calculation-engine/inventory";
export type { ScenarioInput, InventoryPlanInput, PackagingCostResult };
export type { Quantity } from "../../backend/src/domain/inputs";
export type RecordOf<T> = T & { id: string; companyId: string };
export type CompanyRecord = Company & {
  id: string;
  membershipRole: "owner" | "member";
};
export interface Resources {
  products: Product;
  materials: PackagingMaterial;
  formats: PackagingFormat;
  machines: PackagingMachine;
  inventory: PackagingInventory;
  suppliers: Supplier;
  scenarios: ProductionScenario;
}
export type Catalog = { [K in keyof Resources]: RecordOf<Resources[K]>[] };
export type ComparisonResult = ReturnType<typeof compareScenarios>;
export type InventoryResult = ReturnType<typeof planInventory>;
export interface Gateway {
  companies(): Promise<CompanyRecord[]>;
  saveCompany(id: string, company: Company): Promise<CompanyRecord>;
  createCompany(name: string): Promise<CompanyRecord>;
  list<K extends keyof Resources>(
    companyId: string,
    resource: K,
  ): Promise<RecordOf<Resources[K]>[]>;
  save<K extends keyof Resources>(
    companyId: string,
    resource: K,
    id: string | null,
    value: Resources[K],
  ): Promise<RecordOf<Resources[K]>>;
  calculate(input: ScenarioInput): Promise<PackagingCostResult>;
  compare(
    baseline: ScenarioInput,
    alternative: ScenarioInput,
    sameProductAndDemand: boolean,
  ): Promise<ComparisonResult>;
  inventory(input: InventoryPlanInput): Promise<InventoryResult>;
}
