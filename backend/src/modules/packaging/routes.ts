import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import {
  supplierSchema,
  materialSchema,
  formatSchema,
} from "../../domain/entities.js";
import { registerCollection } from "../../shared/crud.js";
export function packagingRoutes(app: FastifyInstance, db: PrismaClient) {
  registerCollection(app, db, "suppliers", supplierSchema, {
    list: (companyId, p) =>
      db.supplier.findMany({
        where: { companyId },
        take: p.limit,
        skip: p.offset,
        orderBy: { id: "asc" },
      }),
    get: (companyId, id) => db.supplier.findFirst({ where: { id, companyId } }),
    create: (companyId, data) =>
      db.supplier.create({ data: { ...data, companyId } }),
    update: (companyId, id, data) =>
      db.supplier.update({ where: { id, companyId }, data }),
    delete: (companyId, id) => db.supplier.delete({ where: { id, companyId } }),
  });
  registerCollection(app, db, "materials", materialSchema, {
    list: (companyId, p) =>
      db.packagingMaterial.findMany({
        where: { companyId },
        take: p.limit,
        skip: p.offset,
        orderBy: { id: "asc" },
      }),
    get: (companyId, id) =>
      db.packagingMaterial.findFirst({ where: { id, companyId } }),
    create: (companyId, data) =>
      db.packagingMaterial.create({ data: { ...data, companyId } }),
    update: (companyId, id, data) =>
      db.packagingMaterial.update({ where: { id, companyId }, data }),
    delete: (companyId, id) =>
      db.packagingMaterial.delete({ where: { id, companyId } }),
  });
  registerCollection(app, db, "formats", formatSchema, {
    list: (companyId, p) =>
      db.packagingFormat.findMany({
        where: { companyId },
        take: p.limit,
        skip: p.offset,
        orderBy: { id: "asc" },
      }),
    get: (companyId, id) =>
      db.packagingFormat.findFirst({ where: { id, companyId } }),
    create: (companyId, data) =>
      db.packagingFormat.create({ data: { ...data, companyId } }),
    update: (companyId, id, data) =>
      db.packagingFormat.update({ where: { id, companyId }, data }),
    delete: (companyId, id) =>
      db.packagingFormat.delete({ where: { id, companyId } }),
  });
}
