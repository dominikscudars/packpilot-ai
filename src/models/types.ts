/** All numeric values are finite JS numbers; field names specify units.
 * null means unknown, never an implicit zero. Shares are ratios from 0 to 1. */
export interface NumericInput {
  value: number | null;
  source: "reported" | "assumption";
  note: string;
}
export interface Company {
  id: string;
  name: string;
  country?: string;
  notes?: string;
}
export interface Product {
  id: string;
  companyId: string;
  name: string;
  category?: string;
  storage?: string;
  shelfLifeDays?: NumericInput;
}
export interface PackagingFormat {
  id: string;
  name: string;
  netWeightGrams: number;
  materialId: string;
  machineId?: string;
}
export interface PackagingMaterial {
  id: string;
  name: string;
  supplierId?: string;
  widthMm?: NumericInput;
  heightMm?: NumericInput;
}
export interface PackagingMachine {
  id: string;
  name: string;
  packagesPerCycle: NumericInput;
  cycleSeconds: NumericInput;
  workers: NumericInput;
  availableHoursPerMonth?: NumericInput;
}
export interface Supplier {
  id: string;
  name: string;
  leadTimeDays?: NumericInput;
  minimumOrderPackages?: NumericInput;
}
export interface PackagingInventory {
  id: string;
  materialId: string;
  onHandPackages: NumericInput;
  safetyStockPackages?: NumericInput;
  recordedOn?: string;
}
export type LaborPricing =
  | { method: "perPackage"; euroPerPackage: NumericInput }
  | { method: "perHour"; euroPerWorkerHour: NumericInput };
export interface FormatAllocation {
  formatId: string;
  shareByWeight: NumericInput;
  materialEuroPerPackage: NumericInput;
}
export interface ProductPlan {
  productId: string;
  productionKg: NumericInput;
  allocations: FormatAllocation[];
}
export interface ProductionScenario {
  id: string;
  name: string;
  plans: ProductPlan[];
  labor: LaborPricing;
}
export interface CalculationCatalog {
  products: Product[];
  formats: PackagingFormat[];
  materials: PackagingMaterial[];
  machines: PackagingMachine[];
}
export interface PackagingCostRow {
  productId: string;
  formatId: string;
  targetKg: number;
  packages: number;
  packagedCapacityKg: number;
  materialEuro: number | null;
  laborEuro: number | null;
  operatingEuro: number | null;
  machineHours: number | null;
  laborHours: number | null;
}
export interface PackagingCostResult {
  productionKg: number;
  totalPackages: number;
  packagedCapacityKg: number;
  materialEuro: number | null;
  laborEuro: number | null;
  operatingEuro: number | null;
  euroPerKg: number | null;
  laborHours: number | null;
  rows: PackagingCostRow[];
  warnings: string[];
}
export interface Workspace extends CalculationCatalog {
  version: 1;
  company: Company;
  suppliers: Supplier[];
  inventory: PackagingInventory[];
  baseline: ProductionScenario;
  alternative: ProductionScenario;
}
