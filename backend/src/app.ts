import { assertDatabaseReady } from "./shared/readiness.js";
import cors from "@fastify/cors";
import { installAuthentication, type SecurityOptions } from "./auth/access.js";
import { membershipRoutes } from "./modules/memberships/routes.js";
import Fastify, { LogController, type FastifyServerOptions } from "fastify";
import { Prisma, type PrismaClient } from "@prisma/client";
import { ZodError } from "zod";
import { DomainError } from "./domain/inputs.js";
import { HttpError } from "./shared/crud.js";
import { companyRoutes } from "./modules/companies/routes.js";
import { productRoutes } from "./modules/products/routes.js";
import { packagingRoutes } from "./modules/packaging/routes.js";
import { machineRoutes } from "./modules/machines/routes.js";
import { inventoryRoutes } from "./modules/inventory/routes.js";
import { scenarioRoutes } from "./modules/scenarios/routes.js";
import { calculationRoutes } from "./modules/costs/routes.js";
export function buildApp(
  db: PrismaClient,
  options: {
    security: SecurityOptions;
    logger?: FastifyServerOptions["logger"];
  },
) {
  const app = Fastify({
    logger: options.logger ?? false,
    logController: new LogController({ disableRequestLogging: true }),
    bodyLimit: 131072,
    trustProxy: false,
  });
  const { security } = options;
  app.addHook("onRequest", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    if (
      security.mode === "local" &&
      !["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(request.ip)
    )
      throw new HttpError(
        403,
        "Development authentication is restricted to loopback access.",
      );
    const host = request.headers.host ?? "";
    let hostname = "";
    try {
      const url = new URL(`http://${host}`);
      if (
        url.username ||
        url.password ||
        url.pathname !== "/" ||
        url.search ||
        url.hash
      )
        throw new Error();
      hostname = url.hostname.toLowerCase();
    } catch {
      throw new HttpError(403, "Host is not allowed.");
    }
    if (!security.allowedHosts.includes(hostname))
      throw new HttpError(403, "Host is not allowed.");
    if (
      request.headers.origin &&
      !security.allowedOrigins.includes(request.headers.origin)
    )
      throw new HttpError(403, "Origin is not allowed.");
  });
  app.register(cors, {
    origin: security.allowedOrigins,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: false,
    maxAge: 600,
  });
  installAuthentication(app, db, security);
  app.setErrorHandler((error, request, reply) => {
    let status = 500,
      code = "INTERNAL_ERROR",
      message = "An unexpected error occurred.";
    let details: unknown;
    if (error instanceof ZodError) {
      status = 400;
      code = "VALIDATION_ERROR";
      message = "Request validation failed.";
      details = error.issues.map((i) => ({
        path: i.path.join("."),
        message: i.message,
      }));
    } else if (error instanceof DomainError) {
      status = 422;
      code = "INVALID_MODEL";
      message = error.message;
    } else if (error instanceof HttpError) {
      status = error.statusCode;
      code =
        status === 401
          ? "UNAUTHENTICATED"
          : status === 404
            ? "NOT_FOUND"
            : status === 503
              ? "SERVICE_UNAVAILABLE"
              : status === 403
                ? "FORBIDDEN"
                : "INVALID_REQUEST";
      message = error.message;
    } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        status = 404;
        code = "NOT_FOUND";
        message = "Record not found.";
      } else if (["P1008", "P2034"].includes(error.code)) {
        status = 409;
        code = "CONCURRENT_UPDATE";
        message = "A concurrent update occurred; retry the request.";
      } else if (["P2002", "P2003"].includes(error.code)) {
        status = 409;
        code = "RELATION_CONFLICT";
        message =
          "A unique value or company-scoped relationship conflicts with existing data.";
      }
    } else if (
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof error.statusCode === "number" &&
      error.statusCode >= 400 &&
      error.statusCode < 500
    ) {
      status = error.statusCode;
      code = "INVALID_REQUEST";
      message =
        status === 413
          ? "Request body is too large."
          : "Malformed or unsupported request.";
    }
    if (status === 500)
      request.log.error(
        { event: "request_failed", requestId: request.id },
        "Request failed",
      );
    return reply.code(status).send({
      error: {
        code,
        message,
        ...(details ? { details } : {}),
        requestId: request.id,
      },
    });
  });
  app.setNotFoundHandler((request, reply) =>
    reply.code(404).send({
      error: {
        code: "NOT_FOUND",
        message: "Endpoint not found.",
        requestId: request.id,
      },
    }),
  );
  app.get("/api/v1/health", { config: { access: "public" } }, async () => {
    await assertDatabaseReady(db);
    return {
      data: { status: "ok", securityMode: security.mode, version: "v1" },
    };
  });
  app.get("/api/v1/auth/me", async (request) => ({ data: request.principal }));
  companyRoutes(app, db);
  membershipRoutes(app, db);
  productRoutes(app, db);
  packagingRoutes(app, db);
  machineRoutes(app, db);
  inventoryRoutes(app, db);
  scenarioRoutes(app, db);
  calculationRoutes(app);
  return app;
}
