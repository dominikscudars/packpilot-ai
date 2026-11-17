import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { savedScenarioSchema } from "../../domain/scenario.js";
import { calculatePackaging } from "../../calculation-engine/packaging.js";
import { registerCollection, HttpError } from "../../shared/crud.js";
export function scenarioRoutes(app: FastifyInstance, db: PrismaClient) {
  registerCollection(app, db, "scenarios", savedScenarioSchema, {
    list: (companyId, p) =>
      db.productionScenario.findMany({
        where: { companyId },
        take: p.limit,
        skip: p.offset,
        orderBy: { id: "asc" },
      }),
    get: (companyId, id) =>
      db.productionScenario.findFirst({ where: { id, companyId } }),
    validate: async (companyId, data) => {
      calculatePackaging(data.input);
      const formats = await db.packagingFormat.count({
        where: { companyId, id: { in: data.input.formats.map((f) => f.id) } },
      });
      const machines = await db.packagingMachine.count({
        where: { companyId, id: { in: data.input.machines.map((m) => m.id) } },
      });
      if (
        formats !== data.input.formats.length ||
        machines !== data.input.machines.length
      )
        throw new HttpError(
          422,
          "Scenario references must belong to this company.",
        );
    },
    create: (companyId, data) =>
      db.productionScenario.create({
        data: {
          companyId,
          ...data,
          allocations: {
            create: data.input.formats.map((f) => ({ formatId: f.id })),
          },
          machines: {
            create: data.input.machines.map((m) => ({ machineId: m.id })),
          },
        },
      }),
    update: (companyId, id, data) =>
      db.productionScenario.update({
        where: { id, companyId },
        data: {
          ...data,
          allocations: {
            deleteMany: {},
            create: data.input.formats.map((f) => ({ formatId: f.id })),
          },
          machines: {
            deleteMany: {},
            create: data.input.machines.map((m) => ({ machineId: m.id })),
          },
        },
      }),
    delete: (companyId, id) =>
      db.productionScenario.delete({ where: { id, companyId } }),
  });
}
