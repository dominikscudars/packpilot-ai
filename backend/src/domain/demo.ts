import { assumed, reported, missing } from "./inputs.js";
import { scenarioInputSchema, type ScenarioInput } from "./scenario.js";
export function createDemoScenario(): ScenarioInput {
  return scenarioInputSchema.parse({
    monthlyProductionKg: reported(
      "1000",
      "OG TOFU reported approximate monthly production.",
    ),
    formats: [
      ["og-format-1kg", "1000", "80"],
      ["og-format-500g", "500", "15"],
      ["og-format-250g", "250", "5"],
    ].map(([id, grams, share]) => ({
      id,
      portionWeightGrams: reported(
        grams,
        "Format size from the pilot brief; commercial use not confirmed.",
      ),
      allocationPercent: assumed(
        share,
        "Illustrative weight mix, not verified sales or demand.",
      ),
      materialCost: {
        method: "combined",
        combinedEuroPerPackage: assumed(
          "0.07",
          "Illustrative combined packaging + label estimate; split not reported.",
        ),
      },
      machineId: "og-hurakan",
    })),
    machines: [
      {
        id: "og-hurakan",
        throughput: {
          method: "cycle",
          packagesPerCycle: reported(
            "2",
            "Approximately two packages per cycle.",
          ),
          cycleSeconds: reported("70", "Approximately 70 seconds per cycle."),
        },
        operators: assumed(
          "1",
          "One continuously occupied operator; validate with observation.",
        ),
        investmentEuro: missing(),
        maintenanceEuroPerMonth: missing(),
        availableHoursPerMonth: missing(),
      },
    ],
    labor: {
      method: "perPackage",
      euroPerPackage: reported(
        "0.15",
        "Approximate packaging labor cost per package.",
      ),
    },
    additionalOperatingEuroPerMonth: missing(),
  });
}
