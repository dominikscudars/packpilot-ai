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
  logger: FastifyServerOptions["logger"] = false,
) {
  const app = Fastify({
    logger,
    logController: new LogController({ disableRequestLogging: true }),
    bodyLimit: 131072,
    trustProxy: false,
  });
  app.addHook("onRequest", async (request) => {
    if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(request.ip))
      throw new HttpError(
        403,
        "This API is restricted to the local demo host.",
      );
    if (request.headers.origin)
      throw new HttpError(
        403,
        "Browser-origin access is disabled in the local demo.",
      );
    if (
      !/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(
        request.headers.host ?? "",
      )
    )
      throw new HttpError(403, "Host is not allowed.");
  });
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
        status === 404
          ? "NOT_FOUND"
          : status === 403
            ? "LOCAL_DEMO_ONLY"
            : "INVALID_REQUEST";
      message = error.message;
    } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2025") {
        status = 404;
        code = "NOT_FOUND";
        message = "Record not found.";
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
    return reply
      .code(status)
      .send({
        error: {
          code,
          message,
          ...(details ? { details } : {}),
          requestId: request.id,
        },
      });
  });
  app.setNotFoundHandler((request, reply) =>
    reply
      .code(404)
      .send({
        error: {
          code: "NOT_FOUND",
          message: "Endpoint not found.",
          requestId: request.id,
        },
      }),
  );
  app.get("/api/v1/health", async () => {
    await db.$queryRaw`SELECT 1`;
    return {
      data: { status: "ok", securityMode: "local-demo", version: "v1" },
    };
  });
  companyRoutes(app, db);
  productRoutes(app, db);
  packagingRoutes(app, db);
  machineRoutes(app, db);
  inventoryRoutes(app, db);
  scenarioRoutes(app, db);
  calculationRoutes(app);
  return app;
}
