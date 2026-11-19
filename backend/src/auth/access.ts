import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Prisma, PrismaClient } from "@prisma/client";
import { idSchema } from "../domain/inputs.js";
import { HttpError } from "../shared/crud.js";
import type { Principal, TokenVerifier } from "./tokens.js";
export interface SecurityOptions {
  mode: "local" | "supabase";
  verifyToken: TokenVerifier;
  allowedOrigins: string[];
  allowedHosts: string[];
}
declare module "fastify" {
  interface FastifyRequest {
    principal: Principal | null;
  }
  interface FastifyContextConfig {
    access?: "public" | "authenticated" | "company-member" | "company-owner";
  }
}
export function principal(request: FastifyRequest): Principal {
  if (!request.principal)
    throw new HttpError(401, "A valid access token is required.");
  return request.principal;
}
export async function requireMembership(
  db: PrismaClient | Prisma.TransactionClient,
  companyId: string,
  userId: string,
  owner = false,
) {
  const membership = await db.companyMembership.findUnique({
    where: { companyId_userId: { companyId, userId } },
  });
  // Do not disclose whether another company's identifier exists.
  if (!membership) throw new HttpError(404, "Company not found.");
  if (owner && membership.role !== "owner")
    throw new HttpError(403, "Company owner access is required.");
  return membership;
}
export function installAuthentication(
  app: FastifyInstance,
  db: PrismaClient,
  security: SecurityOptions,
) {
  app.decorateRequest("principal", null);
  app.addHook("preHandler", async (request, reply) => {
    const policy = request.routeOptions.config.access;
    if (request.method === "OPTIONS") return;
    if (
      request.routeOptions.url?.startsWith("/api/v1/companies/") &&
      policy !== "company-member" &&
      policy !== "company-owner"
    )
      throw new HttpError(403, "Company access policy is required.");
    if (policy === "public") return;
    const header = request.headers.authorization;
    if (
      !header ||
      header.length > 8192 ||
      !/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/i.test(header)
    ) {
      reply.header("WWW-Authenticate", "Bearer");
      throw new HttpError(401, "A valid access token is required.");
    }
    try {
      request.principal = await security.verifyToken(header.slice(7));
    } catch {
      reply.header("WWW-Authenticate", 'Bearer error="invalid_token"');
      throw new HttpError(401, "A valid access token is required.");
    }
    const access = request.routeOptions.config.access;
    if (access === "company-member" || access === "company-owner") {
      const params = request.params as Record<string, unknown>;
      const companyId = idSchema.parse(params.companyId ?? params.id);
      await requireMembership(
        db,
        companyId,
        request.principal.userId,
        access === "company-owner",
      );
    }
  });
}
