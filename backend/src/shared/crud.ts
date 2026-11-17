import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { idSchema } from "../domain/inputs.js";
export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}
const paramsSchema = z
  .object({ companyId: idSchema, id: idSchema.optional() })
  .strict();
export const paginationSchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).max(100000).default(0),
  })
  .strict();
// Zod defaults belong to creates, not omitted PATCH fields.
export function parsePatch<S extends z.ZodObject>(
  schema: S,
  raw: unknown,
): Partial<z.output<S>> {
  const parsed = schema.partial().parse(raw) as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(raw as object).map((key) => [key, parsed[key]]),
  ) as Partial<z.output<S>>;
}
export type Page = z.infer<typeof paginationSchema>;
export async function requireCompany(db: PrismaClient, id: string) {
  if (!(await db.company.findUnique({ where: { id } })))
    throw new HttpError(404, "Company not found.");
}
export function registerCollection<S extends z.ZodObject>(
  app: FastifyInstance,
  db: PrismaClient,
  path: string,
  schema: S,
  repository: {
    list: (companyId: string, page: Page) => Promise<unknown[]>;
    get: (
      companyId: string,
      id: string,
    ) => Promise<Record<string, unknown> | null>;
    create: (companyId: string, data: z.output<S>) => Promise<unknown>;
    update: (
      companyId: string,
      id: string,
      data: z.output<S>,
    ) => Promise<unknown>;
    delete: (companyId: string, id: string) => Promise<unknown>;
    validate?: (companyId: string, data: z.output<S>) => Promise<void>;
  },
) {
  const prefix = `/api/v1/companies/:companyId/${path}`;
  app.get(prefix, async (request) => {
    const { companyId } = paramsSchema.parse(request.params);
    const page = paginationSchema.parse(request.query);
    await requireCompany(db, companyId);
    return { data: await repository.list(companyId, page), pagination: page };
  });
  app.get(`${prefix}/:id`, async (request) => {
    const { companyId, id } = paramsSchema.parse(request.params);
    const item = await repository.get(companyId, id!);
    if (!item) throw new HttpError(404, "Record not found.");
    return { data: item };
  });
  app.post(prefix, async (request, reply) => {
    const { companyId } = paramsSchema.parse(request.params);
    const data = schema.parse(request.body);
    await requireCompany(db, companyId);
    await repository.validate?.(companyId, data);
    return reply
      .code(201)
      .send({ data: await repository.create(companyId, data) });
  });
  app.patch(`${prefix}/:id`, async (request) => {
    const { companyId, id } = paramsSchema.parse(request.params);
    const patch = parsePatch(schema, request.body);
    if (Object.keys(patch).length === 0)
      throw new HttpError(400, "Provide at least one field to update.");
    const existing = await repository.get(companyId, id!);
    if (!existing) throw new HttpError(404, "Record not found.");
    const fields = Object.fromEntries(
      Object.keys(schema.shape).map((key) => [key, existing[key]]),
    );
    const data = schema.parse({ ...fields, ...patch });
    await repository.validate?.(companyId, data);
    return { data: await repository.update(companyId, id!, data) };
  });
  app.delete(`${prefix}/:id`, async (request, reply) => {
    const { companyId, id } = paramsSchema.parse(request.params);
    await repository.delete(companyId, id!);
    return reply.code(204).send();
  });
}
