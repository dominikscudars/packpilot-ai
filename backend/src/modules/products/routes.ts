import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { productSchema } from "../../domain/entities.js";
import { registerCollection } from "../../shared/crud.js";
export function productRoutes(app: FastifyInstance, db: PrismaClient) {
  registerCollection(app, db, "products", productSchema, {
    list: (companyId, p) =>
      db.product.findMany({
        where: { companyId },
        take: p.limit,
        skip: p.offset,
        orderBy: { id: "asc" },
      }),
    get: (companyId, id) => db.product.findFirst({ where: { id, companyId } }),
    create: (companyId, data) =>
      db.product.create({ data: { ...data, companyId } }),
    update: (companyId, id, data) =>
      db.product.update({ where: { id, companyId }, data }),
    delete: (companyId, id) => db.product.delete({ where: { id, companyId } }),
  });
}
