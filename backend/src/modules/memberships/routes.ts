import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { Prisma, PrismaClient } from "@prisma/client";
import { idSchema } from "../../domain/inputs.js";
import { principal, requireMembership } from "../../auth/access.js";
import { HttpError, paginationSchema } from "../../shared/crud.js";
const userId = z.uuid().transform((s) => s.toLowerCase());
const role = z.enum(["owner", "member"]);
const paramsSchema = z
  .object({ companyId: idSchema, userId: userId.optional() })
  .strict();
const ownerAccess = { config: { access: "company-owner" as const } };
/** Serialize membership writes on the company row, then re-check actor privileges. */
export async function ownerTransaction<T>(
  db: PrismaClient,
  companyId: string,
  actor: string,
  action: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return db.$transaction(async (tx) => {
    await tx.company.update({
      where: { id: companyId },
      data: { updatedAt: new Date() },
    });
    await requireMembership(tx, companyId, actor, true);
    return action(tx);
  });
}
export function membershipRoutes(app: FastifyInstance, db: PrismaClient) {
  const path = "/api/v1/companies/:companyId/memberships";
  app.get(path, ownerAccess, async (request) => {
    const { companyId } = paramsSchema.parse(request.params);
    const p = paginationSchema.parse(request.query);
    return {
      data: await db.companyMembership.findMany({
        where: { companyId },
        take: p.limit,
        skip: p.offset,
        orderBy: { userId: "asc" },
      }),
      pagination: p,
    };
  });
  app.post(path, ownerAccess, async (request, reply) => {
    const { companyId } = paramsSchema.parse(request.params);
    const data = z.object({ userId, role }).strict().parse(request.body);
    return reply
      .code(201)
      .send({
        data: await ownerTransaction(
          db,
          companyId,
          principal(request).userId,
          (tx) => tx.companyMembership.create({ data: { companyId, ...data } }),
        ),
      });
  });
  app.patch(`${path}/:userId`, ownerAccess, async (request) => {
    const { companyId, userId } = paramsSchema.parse(request.params);
    const data = z.object({ role }).strict().parse(request.body);
    return {
      data: await ownerTransaction(
        db,
        companyId,
        principal(request).userId,
        async (tx) => {
          const existing = await tx.companyMembership.findUnique({
            where: { companyId_userId: { companyId, userId: userId! } },
          });
          if (!existing) throw new HttpError(404, "Membership not found.");
          if (
            existing.role === "owner" &&
            data.role === "member" &&
            (await tx.companyMembership.count({
              where: { companyId, role: "owner" },
            })) <= 1
          )
            throw new HttpError(
              409,
              "A company must retain at least one owner.",
            );
          return tx.companyMembership.update({
            where: { companyId_userId: { companyId, userId: userId! } },
            data,
          });
        },
      ),
    };
  });
  app.delete(`${path}/:userId`, ownerAccess, async (request, reply) => {
    const { companyId, userId } = paramsSchema.parse(request.params);
    await ownerTransaction(
      db,
      companyId,
      principal(request).userId,
      async (tx) => {
        const existing = await tx.companyMembership.findUnique({
          where: { companyId_userId: { companyId, userId: userId! } },
        });
        if (!existing) throw new HttpError(404, "Membership not found.");
        if (
          existing.role === "owner" &&
          (await tx.companyMembership.count({
            where: { companyId, role: "owner" },
          })) <= 1
        )
          throw new HttpError(409, "A company must retain at least one owner.");
        await tx.companyMembership.delete({
          where: { companyId_userId: { companyId, userId: userId! } },
        });
      },
    );
    return reply.code(204).send();
  });
}
