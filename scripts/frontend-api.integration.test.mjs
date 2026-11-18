// Real HTTP integration: temporary SQLite, generated ES256 keys, no live credentials.
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { buildApp } from "../backend/src/app.ts";
import { seedDemo } from "../backend/src/shared/seedDemo.ts";
import { bootstrapOwner } from "../backend/src/auth/bootstrap.ts";
import {
  createAuthFixture,
  OWNER,
  OUTSIDER,
} from "../backend/tests/authFixture.ts";
import { createDemoScenario } from "../backend/src/domain/demo.ts";
import { createApi } from "../src/api/client.ts";
const requireBackend = createRequire(
  new URL("../backend/package.json", import.meta.url),
);
const { PrismaClient } = requireBackend("@prisma/client");
let dir, db, app, fixture, baseUrl, client;
let expired = 0,
  refreshed = 0,
  token;
const auth = {
  current: async () => ({ userId: OWNER, accessToken: token }),
  refresh: async () => {
    refreshed++;
    token = await fixture.token();
    return { userId: OWNER, accessToken: token };
  },
};
before(async () => {
  dir = await mkdtemp(join(tmpdir(), "packpilot-frontend-api-"));
  const databaseUrl = `file:${join(dir, "test.db")}`;
  execFileSync(process.execPath, ["--import", "tsx", "scripts/migrate.ts"], {
    cwd: new URL("../backend/", import.meta.url),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "pipe",
  });
  db = new PrismaClient({ datasourceUrl: databaseUrl });
  await seedDemo(db);
  await bootstrapOwner(db, "og-tofu", OWNER);
  fixture = await createAuthFixture();
  token = await fixture.token();
  app = buildApp(db, { security: fixture.security });
  baseUrl = await app.listen({ port: 0, host: "127.0.0.1" });
  client = createApi(baseUrl, auth, OWNER, () => {
    expired++;
  });
});
after(async () => {
  await app?.close();
  await db?.$disconnect();
  if (dir) await rm(dir, { recursive: true, force: true });
});
test("frontend client reads membership-scoped companies, profile and scenarios", async () => {
  const companies = await client.companies();
  assert.equal(companies.length, 1);
  assert.equal(companies[0].membershipRole, "owner");
  assert.equal(
    (await client.list("og-tofu", "products"))[0].name,
    "Fresh tofu",
  );
  assert.equal(
    (await client.list("og-tofu", "scenarios"))[0].name,
    "Illustrative OG TOFU reference",
  );
  await client.saveCompany("og-tofu", {
    name: "Edited via frontend client",
    country: "Latvia",
    industryCategory: null,
  });
  assert.equal(
    (await client.companies())[0].name,
    "Edited via frontend client",
  );
});
test("frontend client receives authoritative reference results and saves/reloads snapshots", async () => {
  const input = createDemoScenario();
  const result = await client.calculate(input);
  assert.deepEqual(
    result.rows.map((row) => row.packages),
    [800, 300, 200],
  );
  assert.equal(result.totalMaterialEuro, "91");
  assert.equal(result.totalLaborEuro, "195");
  assert.equal(result.totalPackagingOperatingEuro, "286");
  assert.equal(result.packagingEuroPerPlannedKg, "0.286");
  const saved = await client.save("og-tofu", "scenarios", null, {
    name: "Frontend snapshot",
    kind: "modeled",
    input,
  });
  assert.equal(
    (await client.list("og-tofu", "scenarios")).find((s) => s.id === saved.id)
      .input.monthlyProductionKg.value,
    "1000",
  );
  input.monthlyProductionKg = { value: "1.125", quality: "assumption" };
  const fractional = await client.calculate(input);
  assert.equal(fractional.unpackagedProductionKg, "0.125");
  const comparison = await client.compare(createDemoScenario(), input, false);
  assert.equal(comparison.monthlyNetSavingsEuro, null);
});
test("frontend client calculates inventory and saves stock separately", async () => {
  const q = (value) => ({ value, quality: "assumption" });
  const result = await client.inventory({
    currentStockPackages: q("100"),
    expectedMonthlyConsumptionPackages: q("300"),
    calendarDaysInPlanningMonth: q("30"),
    workingDaysInPlanningMonth: q("20"),
    leadTimeCalendarDays: q("10"),
    minimumOrderPackages: q("50"),
    safetyStockPackages: q("20"),
    reviewPeriodCalendarDays: q("5"),
    outstandingPurchaseOrders: [],
  });
  assert.equal(result.reorderPointPackages, "120");
  assert.equal(result.suggestedOrderPackages, "70");
  const [stock] = await client.list("og-tofu", "inventory");
  await client.save("og-tofu", "inventory", stock.id, {
    materialId: stock.materialId,
    formatId: null,
    currentStockPackages: q("100"),
    packagesPerProductionKg: stock.packagesPerProductionKg,
    supplierLeadTimeCalendarDays: q("10"),
    minimumOrderPackages: q("50"),
    safetyStockPackages: q("20"),
  });
  assert.equal(
    (await client.list("og-tofu", "inventory"))[0].currentStockPackages.value,
    "100",
  );
});
test("frontend client refreshes an actually expired signed JWT once", async () => {
  token = await fixture.token(OWNER, {
    exp: Math.floor(Date.now() / 1000) - 60,
    iat: Math.floor(Date.now() / 1000) - 3600,
  });
  assert.equal((await client.companies()).length, 1);
  assert.equal(refreshed, 1);
  assert.equal(expired, 0);
});
test("real API rejects missing/invalid authentication and cross-company client requests", async () => {
  assert.equal((await fetch(`${baseUrl}/api/v1/companies`)).status, 401);
  assert.equal(
    (
      await fetch(`${baseUrl}/api/v1/calculations/packaging-costs`, {
        method: "POST",
        headers: {
          Authorization: "Bearer invalid",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(createDemoScenario()),
      })
    ).status,
    401,
  );
  const outsider = createApi(
    baseUrl,
    {
      ...auth,
      current: async () => ({
        userId: OUTSIDER,
        accessToken: await fixture.token(OUTSIDER),
      }),
    },
    OUTSIDER,
    () => {},
  );
  assert.deepEqual(await outsider.companies(), []);
  await assert.rejects(
    outsider.list("og-tofu", "scenarios"),
    (error) => error.status === 404,
  );
  assert.equal(refreshed, 1);
});
