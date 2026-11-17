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
      data: await db.company.findMany({
        take: pagination.limit,
        skip: pagination.offset,
        orderBy: { id: "asc" },
      }),
      pagination,
    };
  });
  app.post("/api/v1/companies", async (request, reply) =>
    reply
      .code(201)
      .send({
        data: await db.company.create({
          data: companySchema.parse(request.body),
        }),
      }),
  );
  app.get("/api/v1/companies/:id", async (request) => {
    const { id } = params.parse(request.params);
    const company = await db.company.findUnique({ where: { id } });
    if (!company) throw new HttpError(404, "Company not found.");
    return { data: company };
  });
  app.patch("/api/v1/companies/:id", async (request) => {
    const { id } = params.parse(request.params);
    const data = parsePatch(companySchema, request.body);
    if (!Object.keys(data).length)
      throw new HttpError(400, "Provide at least one field to update.");
    return { data: await db.company.update({ where: { id }, data }) };
  });
  app.delete("/api/v1/companies/:id", async (request, reply) => {
    const { id } = params.parse(request.params);
    await db.company.delete({ where: { id } });
    return reply.code(204).send();
  });
}
