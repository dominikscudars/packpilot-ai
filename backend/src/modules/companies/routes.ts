import { principal } from "../../auth/access.js";
import { ownerTransaction } from "../memberships/routes.js";
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { companySchema } from "../../domain/entities.js";
import { idSchema } from "../../domain/inputs.js";
import { HttpError, paginationSchema, parsePatch } from "../../shared/crud.js";
export function companyRoutes(app: FastifyInstance, db: PrismaClient) {
  const params = z.object({ id: idSchema }).strict();
  app.get("/api/v1/companies", async (request) => {
    const pagination = paginationSchema.parse(request.query);
    return {
      data: (
        await db.company.findMany({
          where: {
            memberships: { some: { userId: principal(request).userId } },
          },
          include: {
            memberships: {
              where: { userId: principal(request).userId },
              select: { role: true },
            },
          },
          take: pagination.limit,
          skip: pagination.offset,
          orderBy: { id: "asc" },
        })
      ).flatMap(({ memberships, ...company }) => {
        const membership = memberships[0];
        // Fail closed if a membership disappeared during relation loading.
        return membership
          ? [{ ...company, membershipRole: membership.role }]
          : [];
      }),
      pagination,
    };
  });
  app.post("/api/v1/companies", async (request, reply) =>
    reply.code(201).send({
      data: await db.company.create({
        data: {
          ...companySchema.parse(request.body),
          memberships: {
            create: { userId: principal(request).userId, role: "owner" },
          },
        },
      }),
    }),
  );
  app.get(
    "/api/v1/companies/:id",
    { config: { access: "company-member" } },
    async (request) => {
      const { id } = params.parse(request.params);
      const company = await db.company.findUnique({ where: { id } });
      if (!company) throw new HttpError(404, "Company not found.");
      return { data: company };
    },
  );
  app.patch(
    "/api/v1/companies/:id",
    { config: { access: "company-owner" } },
    async (request) => {
      const { id } = params.parse(request.params);
      const data = parsePatch(companySchema, request.body);
      if (!Object.keys(data).length)
        throw new HttpError(400, "Provide at least one field to update.");
      return {
        data: await ownerTransaction(db, id, principal(request).userId, (tx) =>
          tx.company.update({ where: { id }, data }),
        ),
      };
    },
  );
  app.delete(
    "/api/v1/companies/:id",
    { config: { access: "company-owner" } },
    async (request, reply) => {
      const { id } = params.parse(request.params);
      await ownerTransaction(db, id, principal(request).userId, (tx) =>
        tx.company.delete({ where: { id } }),
      );
      return reply.code(204).send();
    },
  );
}
