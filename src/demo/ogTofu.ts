import type { NumericInput, Workspace } from "../models/types";
export const reported = (value: number | null, note: string): NumericInput => ({
  value,
  source: "reported",
  note,
});
export const assumed = (value: number | null, note: string): NumericInput => ({
  value,
  source: "assumption",
  note,
});
export function createDemo(): Workspace {
  const baseline: Workspace["baseline"] = {
    id: "baseline",
    name: "Current operation",
    plans: [
      {
        productId: "tofu",
        productionKg: reported(
          1000,
          "README: approximately 1,000 kg per month.",
        ),
        allocations: [
          {
            formatId: "1kg",
            shareByWeight: assumed(
              0.8,
              "Hypothetical mix by weight, not verified sales.",
            ),
            materialEuroPerPackage: assumed(
              0.07,
              "Midpoint of reported €0.06–0.08; includes labeling.",
            ),
          },
          {
            formatId: "500g",
            shareByWeight: assumed(
              0.15,
              "Hypothetical mix by weight, not verified sales.",
            ),
            materialEuroPerPackage: assumed(
              0.07,
              "Midpoint of reported €0.06–0.08; includes labeling.",
            ),
          },
          {
            formatId: "250g",
            shareByWeight: assumed(
              0.05,
              "Hypothetical mix by weight, not verified sales.",
            ),
            materialEuroPerPackage: assumed(
              0.07,
              "Midpoint of reported €0.06–0.08; includes labeling.",
            ),
          },
        ],
      },
    ],
    labor: {
      method: "perPackage",
      euroPerPackage: reported(
        0.15,
        "README: approximately €0.15 packaging labor per package.",
      ),
    },
  };
  return {
    version: 1,
    company: {
      id: "og-tofu",
      name: "OG TOFU",
      country: "Latvia",
      notes:
        "Initial pilot. Customer research is ongoing; source: project README.",
    },
    products: [
      {
        id: "tofu",
        companyId: "og-tofu",
        name: "Fresh tofu",
        category: "Plant-based food",
        storage: "Refrigerated",
        shelfLifeDays: reported(
          10,
          "README: approximately 10 days; not a shelf-life certification.",
        ),
      },
    ],
    formats: [
      {
        id: "1kg",
        name: "1 kg",
        netWeightGrams: 1000,
        materialId: "pape",
        machineId: "hurakan",
      },
      {
        id: "500g",
        name: "500 g",
        netWeightGrams: 500,
        materialId: "pape",
        machineId: "hurakan",
      },
      {
        id: "250g",
        name: "250 g",
        netWeightGrams: 250,
        materialId: "pape",
        machineId: "hurakan",
      },
    ],
    materials: [{ id: "pape", name: "PA/PE vacuum bag + label" }],
    machines: [
      {
        id: "hurakan",
        name: "HURAKAN VAC 400",
        packagesPerCycle: reported(
          2,
          "README: approximately two packages per cycle.",
        ),
        cycleSeconds: reported(
          70,
          "README: approximately 70 seconds per cycle.",
        ),
        workers: assumed(
          1,
          "One continuously occupied worker; staffing and handling time need validation.",
        ),
      },
    ],
    suppliers: [],
    inventory: [],
    baseline,
    alternative: {
      ...structuredClone(baseline),
      id: "alternative",
      name: "Alternative scenario",
    },
  };
}
