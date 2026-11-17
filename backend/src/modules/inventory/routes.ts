import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { inventoryRecordSchema } from "../../domain/entities.js";
import { registerCollection, HttpError } from "../../shared/crud.js";
export function inventoryRoutes(app: FastifyInstance, db: PrismaClient) {
  registerCollection(app, db, "inventory", inventoryRecordSchema, {
    list: (companyId, p) =>
      db.packagingInventory.findMany({
        where: { companyId },
        take: p.limit,
        skip: p.offset,
        orderBy: { id: "asc" },
      }),
    get: (companyId, id) =>
      db.packagingInventory.findFirst({ where: { id, companyId } }),
    validate: async (_companyId, data) => {
      if ((data.formatId === null) === (data.materialId === null))
        throw new HttpError(
          422,
          "Inventory must reference exactly one format or material.",
        );
    },
    create: (companyId, data) =>
      db.packagingInventory.create({ data: { ...data, companyId } }),
    update: (companyId, id, data) =>
      db.packagingInventory.update({ where: { id, companyId }, data }),
    delete: (companyId, id) =>
      db.packagingInventory.delete({ where: { id, companyId } }),
  });
}
