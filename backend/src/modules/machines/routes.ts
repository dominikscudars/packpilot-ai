import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { machineSchema } from "../../domain/entities.js";
import { registerCollection } from "../../shared/crud.js";
export function machineRoutes(app: FastifyInstance, db: PrismaClient) {
  registerCollection(app, db, "machines", machineSchema, {
    list: (companyId, p) =>
      db.packagingMachine.findMany({
        where: { companyId },
        take: p.limit,
        skip: p.offset,
        orderBy: { id: "asc" },
      }),
    get: (companyId, id) =>
      db.packagingMachine.findFirst({ where: { id, companyId } }),
    create: (companyId, data) =>
      db.packagingMachine.create({ data: { ...data, companyId } }),
    update: (companyId, id, data) =>
      db.packagingMachine.update({ where: { id, companyId }, data }),
    delete: (companyId, id) =>
      db.packagingMachine.delete({ where: { id, companyId } }),
  });
}
