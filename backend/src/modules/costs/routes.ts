import type { FastifyInstance } from "fastify";
import { scenarioInputSchema, compareSchema } from "../../domain/scenario.js";
import { inventoryPlanSchema } from "../../domain/inventory.js";
import { calculatePackaging } from "../../calculation-engine/packaging.js";
import { compareScenarios } from "../../calculation-engine/comparison.js";
import { planInventory } from "../../calculation-engine/inventory.js";
export function calculationRoutes(app: FastifyInstance) {
  app.post("/api/v1/calculations/packaging-costs", async (request) => ({
    data: calculatePackaging(scenarioInputSchema.parse(request.body)),
  }));
  app.post("/api/v1/calculations/compare-scenarios", async (request) => ({
    data: compareScenarios(compareSchema.parse(request.body)),
  }));
  app.post("/api/v1/calculations/inventory-plan", async (request) => ({
    data: planInventory(inventoryPlanSchema.parse(request.body)),
  }));
}
