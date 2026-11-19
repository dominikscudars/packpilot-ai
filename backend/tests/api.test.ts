import { createAuthFixture, OWNER } from "./authFixture.js";
import { bootstrapOwner } from "../src/auth/bootstrap.js";
import type { InjectOptions } from "fastify";
import { afterAll, beforeAll, describe, it, expect } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { buildApp } from "../src/app.js";
import { seedDemo } from "../src/shared/seedDemo.js";
import { createDemoScenario } from "../src/domain/demo.js";
import { assumed } from "../src/domain/inputs.js";
import { formatSchema, inventoryRecordSchema } from "../src/domain/entities.js";
import { loadServerConfig } from "../src/config/env.js";
let accessToken: string;
let directory: string;
function authenticatedInject(options: InjectOptions) {
  return app.inject({
    ...options,
    headers: { authorization: `Bearer ${accessToken}`, ...options.headers },
  });
}
let db: PrismaClient;
let app: ReturnType<typeof buildApp>;
const q = (v: string) => assumed(v, "Integration test assumption");
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "packpilot-backend-"));
  const databaseUrl = `file:${join(directory, "integration.db")}`;
  execFileSync(process.execPath, ["--import", "tsx", "scripts/migrate.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "pipe",
  });
  db = new PrismaClient({ datasourceUrl: databaseUrl });
  await seedDemo(db);
  const fixture = await createAuthFixture();
  accessToken = await fixture.token();
  await bootstrapOwner(db, "og-tofu", OWNER);
  app = buildApp(db, { security: fixture.security });
  await app.ready();
});
afterAll(async () => {
  await app?.close();
  await db?.$disconnect();
  if (directory) await rm(directory, { recursive: true, force: true });
});
describe("REST API with real migrated SQLite database", () => {
  it("checks database health", async () => {
    const r = await authenticatedInject({ url: "/api/v1/health" });
    expect(r.statusCode).toBe(200);
    expect(r.json().data.status).toBe("ok");
  });
  it("seeds all formats as illustrative without fabricated dimensions or suppliers", async () => {
    const r = await authenticatedInject({
      url: "/api/v1/companies/og-tofu/formats",
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().data).toHaveLength(3);
    for (const f of r.json().data) {
      expect(f.commercialStatus).toBe("illustrative");
      expect(f.lengthMm.value).toBeNull();
    }
    expect(await db.supplier.count()).toBe(0);
  });
  it("re-seeding is idempotent and preserves edited demo values", async () => {
    await db.company.update({
      where: { id: "og-tofu" },
      data: { name: "Edited OG TOFU" },
    });
    await seedDemo(db);
    expect(await db.company.count()).toBe(1);
    expect(
      (await db.company.findUniqueOrThrow({ where: { id: "og-tofu" } })).name,
    ).toBe("Edited OG TOFU");
    expect(await db.productionScenario.count()).toBe(1);
  });
  it("creates, patches, reads and deletes company data", async () => {
    const created = await authenticatedInject({
      method: "POST",
      url: "/api/v1/companies",
      payload: { name: "Test company", industryCategory: "Test category" },
    });
    expect(created.statusCode).toBe(201);
    const id = created.json().data.id;
    const patch = await authenticatedInject({
      method: "PATCH",
      url: `/api/v1/companies/${id}`,
      payload: { country: "Latvia" },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().data.name).toBe("Test company");
    expect(patch.json().data.industryCategory).toBe("Test category");
    expect(
      (await authenticatedInject({ url: `/api/v1/companies/${id}` })).json()
        .data.country,
    ).toBe("Latvia");
    expect(
      (
        await authenticatedInject({
          method: "DELETE",
          url: `/api/v1/companies/${id}`,
        })
      ).statusCode,
    ).toBe(204);
  });
  it("creates and edits products, suppliers, materials, formats, machines and stock", async () => {
    const base = "/api/v1/companies/og-tofu";
    const product = await authenticatedInject({
      method: "POST",
      url: `${base}/products`,
      payload: { name: "Test product" },
    });
    expect(product.statusCode).toBe(201);
    const supplier = await authenticatedInject({
      method: "POST",
      url: `${base}/suppliers`,
      payload: { name: "Test supplier", leadTimeCalendarDays: q("7") },
    });
    expect(supplier.statusCode).toBe(201);
    const material = await authenticatedInject({
      method: "POST",
      url: `${base}/materials`,
      payload: { name: "Test material", supplierId: supplier.json().data.id },
    });
    expect(material.statusCode).toBe(201);
    const format = await authenticatedInject({
      method: "POST",
      url: `${base}/formats`,
      payload: {
        productId: product.json().data.id,
        materialId: material.json().data.id,
        portionWeightGrams: q("500"),
        materialCost: {
          method: "itemized",
          bagEuroPerPackage: q("0.06"),
          labelEuroPerPackage: q("0.01"),
        },
      },
    });
    expect(format.statusCode).toBe(201);
    const machine = await authenticatedInject({
      method: "POST",
      url: `${base}/machines`,
      payload: {
        model: "Test machine",
        throughput: { method: "rate", packagesPerHour: q("200") },
        operators: q("2"),
      },
    });
    expect(machine.statusCode).toBe(201);
    const inventory = await authenticatedInject({
      method: "POST",
      url: `${base}/inventory`,
      payload: {
        formatId: format.json().data.id,
        currentStockPackages: q("500"),
      },
    });
    expect(inventory.statusCode).toBe(201);
    const patch = await authenticatedInject({
      method: "PATCH",
      url: `${base}/inventory/${inventory.json().data.id}`,
      payload: { currentStockPackages: q("600") },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().data.currentStockPackages.value).toBe("600");
    expect(patch.json().data.formatId).toBe(format.json().data.id);
    expect(
      (
        await authenticatedInject({
          method: "PATCH",
          url: `${base}/machines/${machine.json().data.id}`,
          payload: { operators: q("3") },
        })
      ).json().data.operators.value,
    ).toBe("3");
  });
  it("persists scenarios and relational links atomically", async () => {
    const input = createDemoScenario();
    const created = await authenticatedInject({
      method: "POST",
      url: "/api/v1/companies/og-tofu/scenarios",
      payload: { name: "Test alternative", kind: "modeled", input },
    });
    expect(created.statusCode).toBe(201);
    const id = created.json().data.id;
    expect(
      await db.scenarioAllocation.count({ where: { scenarioId: id } }),
    ).toBe(3);
    input.monthlyProductionKg = q("2000");
    const updated = await authenticatedInject({
      method: "PATCH",
      url: `/api/v1/companies/og-tofu/scenarios/${id}`,
      payload: { input },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().data.input.monthlyProductionKg.value).toBe("2000");
    expect(
      await db.scenarioAllocation.count({ where: { scenarioId: id } }),
    ).toBe(3);
    expect(
      (
        await authenticatedInject({
          method: "DELETE",
          url: `/api/v1/companies/og-tofu/scenarios/${id}`,
        })
      ).statusCode,
    ).toBe(204);
    expect(
      await db.scenarioAllocation.count({ where: { scenarioId: id } }),
    ).toBe(0);
  });
  it("runs a hypothetical calculation without saving a scenario", async () => {
    const before = await db.productionScenario.count();
    const r = await authenticatedInject({
      method: "POST",
      url: "/api/v1/calculations/packaging-costs",
      payload: createDemoScenario(),
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().data.totalPackagingOperatingEuro).toBe("286");
    expect(await db.productionScenario.count()).toBe(before);
  });
  it("exposes comparison and inventory calculators", async () => {
    expect(
      (
        await authenticatedInject({
          method: "POST",
          url: "/api/v1/calculations/compare-scenarios",
          payload: {
            baseline: createDemoScenario(),
            alternative: createDemoScenario(),
            sameProductAndDemand: true,
          },
        })
      ).statusCode,
    ).toBe(200);
    const r = await authenticatedInject({
      method: "POST",
      url: "/api/v1/calculations/inventory-plan",
      payload: {
        currentStockPackages: q("500"),
        expectedMonthlyConsumptionPackages: q("3000"),
        calendarDaysInPlanningMonth: q("30"),
        workingDaysInPlanningMonth: q("20"),
        leadTimeCalendarDays: q("5"),
        minimumOrderPackages: q("1000"),
        safetyStockPackages: q("100"),
        reviewPeriodCalendarDays: q("10"),
        outstandingPurchaseOrders: [],
      },
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().data.suggestedOrderPackages).toBe("1100");
  });
  it("rejects cross-company relational references in both API and database", async () => {
    const other = await db.company.create({ data: { name: "Other company" } });
    await bootstrapOwner(db, other.id, OWNER);
    const body = formatSchema.parse({
      productId: "og-fresh-tofu",
      materialId: "og-pape",
      portionWeightGrams: q("250"),
      materialCost: { method: "combined", combinedEuroPerPackage: q("0.07") },
    });
    const r = await authenticatedInject({
      method: "POST",
      url: `/api/v1/companies/${other.id}/formats`,
      payload: body,
    });
    expect(r.statusCode).toBe(409);
    await expect(
      db.packagingFormat.create({ data: { companyId: other.id, ...body } }),
    ).rejects.toThrow();
    const scenario = await authenticatedInject({
      method: "POST",
      url: `/api/v1/companies/${other.id}/scenarios`,
      payload: {
        name: "Wrong references",
        kind: "modeled",
        input: createDemoScenario(),
      },
    });
    expect(scenario.statusCode).toBe(422);
  });
  it("enforces exactly one inventory reference in API and database", async () => {
    const r = await authenticatedInject({
      method: "POST",
      url: "/api/v1/companies/og-tofu/inventory",
      payload: {},
    });
    expect(r.statusCode).toBe(422);
    await expect(
      db.packagingInventory.create({
        data: {
          companyId: "og-tofu",
          ...inventoryRecordSchema.parse({
            formatId: "og-format-1kg",
            materialId: "og-pape",
          }),
        },
      }),
    ).rejects.toThrow();
  });
  it("keeps foreign-key failures safe and blocks deleting referenced records", async () => {
    const r = await authenticatedInject({
      method: "DELETE",
      url: "/api/v1/companies/og-tofu/products/og-fresh-tofu",
    });
    expect(r.statusCode).toBe(409);
    expect(r.json().error.code).toBe("RELATION_CONFLICT");
    expect(r.body).not.toContain("Prisma");
  });
  it("returns consistent validation, semantic and missing-record errors", async () => {
    const invalid = await authenticatedInject({
      method: "POST",
      url: "/api/v1/companies",
      payload: { name: "", unexpected: true },
    });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json().error.code).toBe("VALIDATION_ERROR");
    const input = createDemoScenario();
    input.formats[0].allocationPercent = q("70");
    expect(
      (
        await authenticatedInject({
          method: "POST",
          url: "/api/v1/calculations/packaging-costs",
          payload: input,
        })
      ).statusCode,
    ).toBe(422);
    expect(
      (await authenticatedInject({ url: "/api/v1/companies/missing" }))
        .statusCode,
    ).toBe(404);
    expect(
      (await authenticatedInject({ url: "/not-found" })).json().error.code,
    ).toBe("NOT_FOUND");
  });
  it("rejects malformed JSON and invalid pagination", async () => {
    expect(
      (
        await authenticatedInject({
          method: "POST",
          url: "/api/v1/companies",
          headers: { "content-type": "application/json" },
          payload: "{",
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (await authenticatedInject({ url: "/api/v1/companies?limit=-1" }))
        .statusCode,
    ).toBe(400);
  });
  it("rejects arbitrary nonnumeric strings as validation errors, not internal failures", async () => {
    for (const value of ["abc", "1e999999", "NaN"]) {
      const input = createDemoScenario();
      input.monthlyProductionKg = q(value);
      const r = await authenticatedInject({
        method: "POST",
        url: "/api/v1/calculations/packaging-costs",
        payload: input,
      });
      expect(r.statusCode).toBe(400);
      expect(r.json().error.code).toBe("VALIDATION_ERROR");
    }
  });
  it("rejects external hosts, origins, remote peers and public bind configuration", async () => {
    expect(
      (
        await authenticatedInject({
          url: "/api/v1/companies",
          headers: { host: "attacker.example" },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await authenticatedInject({
          url: "/api/v1/companies",
          headers: { origin: "https://example.com" },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await authenticatedInject({
          url: "/api/v1/companies",
          remoteAddress: "192.0.2.1",
        })
      ).statusCode,
    ).toBe(403);
    expect(() =>
      loadServerConfig({ AUTH_MODE: "local", HOST: "0.0.0.0" }),
    ).toThrow();
  });
});

it("reports an unmigrated database as unavailable rather than healthy", async () => {
  const empty = new PrismaClient({
    datasourceUrl: `file:${join(directory, "unmigrated.db")}`,
  });
  const fixture = await createAuthFixture();
  const unready = buildApp(empty, { security: fixture.security });
  try {
    const response = await unready.inject({ url: "/api/v1/health" });
    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe("SERVICE_UNAVAILABLE");
    expect(response.body).not.toContain("CompanyMembership");
  } finally {
    await unready.close();
    await empty.$disconnect();
  }
});
it("prevents caching of authenticated data and errors", async () => {
  for (const response of [
    await authenticatedInject({ url: "/api/v1/companies" }),
    await app.inject({ url: "/api/v1/companies" }),
  ]) {
    expect(response.headers["cache-control"]).toBe("no-store");
  }
});
