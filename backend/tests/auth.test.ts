import { afterAll, beforeAll, describe, it, expect } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";
import type { InjectOptions } from "fastify";
import { buildApp } from "../src/app.js";
import { seedDemo } from "../src/shared/seedDemo.js";
import { bootstrapOwner } from "../src/auth/bootstrap.js";
import { createDemoScenario } from "../src/domain/demo.js";
import {
  createAuthFixture,
  OWNER,
  MEMBER,
  OUTSIDER,
  SECOND_OWNER,
} from "./authFixture.js";
let directory: string,
  db: PrismaClient,
  app: ReturnType<typeof buildApp>,
  fixture: Awaited<ReturnType<typeof createAuthFixture>>;
let owner: string,
  member: string,
  outsider: string,
  otherCompany: string,
  orphanCompany: string;
const collections = [
  "products",
  "suppliers",
  "materials",
  "formats",
  "machines",
  "inventory",
  "scenarios",
];
const companyRoutes: InjectOptions[] = [
  { method: "GET", url: "/api/v1/companies/og-tofu" },
  { method: "PATCH", url: "/api/v1/companies/og-tofu", payload: {} },
  { method: "DELETE", url: "/api/v1/companies/og-tofu" },
  ...collections.flatMap((c) => [
    { method: "GET" as const, url: `/api/v1/companies/og-tofu/${c}` },
    {
      method: "POST" as const,
      url: `/api/v1/companies/og-tofu/${c}`,
      payload: {},
    },
    { method: "GET" as const, url: `/api/v1/companies/og-tofu/${c}/record` },
    {
      method: "PATCH" as const,
      url: `/api/v1/companies/og-tofu/${c}/record`,
      payload: {},
    },
    { method: "DELETE" as const, url: `/api/v1/companies/og-tofu/${c}/record` },
  ]),
  { method: "GET", url: "/api/v1/companies/og-tofu/memberships" },
  { method: "POST", url: "/api/v1/companies/og-tofu/memberships", payload: {} },
  {
    method: "PATCH",
    url: `/api/v1/companies/og-tofu/memberships/${OWNER}`,
    payload: {},
  },
  { method: "DELETE", url: `/api/v1/companies/og-tofu/memberships/${OWNER}` },
];
const protectedRoutes: InjectOptions[] = [
  ...companyRoutes,
  { method: "GET", url: "/api/v1/companies" },
  { method: "POST", url: "/api/v1/companies", payload: {} },
  { method: "GET", url: "/api/v1/auth/me" },
  ...["packaging-costs", "compare-scenarios", "inventory-plan"].map((name) => ({
    method: "POST" as const,
    url: `/api/v1/calculations/${name}`,
    payload: {},
  })),
];
function request(token: string, options: InjectOptions) {
  return app.inject({
    ...options,
    headers: { authorization: `Bearer ${token}`, ...options.headers },
  });
}
async function createCompany() {
  const r = await request(owner, {
    method: "POST",
    url: "/api/v1/companies",
    payload: { name: "Membership test company" },
  });
  expect(r.statusCode).toBe(201);
  return r.json().data.id as string;
}
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "packpilot-auth-"));
  const databaseUrl = `file:${join(directory, "test.db")}`;
  execFileSync(process.execPath, ["--import", "tsx", "scripts/migrate.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: "pipe",
  });
  db = new PrismaClient({ datasourceUrl: databaseUrl });
  await seedDemo(db);
  await bootstrapOwner(db, "og-tofu", OWNER);
  await db.companyMembership.create({
    data: { companyId: "og-tofu", userId: MEMBER, role: "member" },
  });
  otherCompany = (
    await db.company.create({
      data: {
        name: "Private second company",
        memberships: { create: { userId: OUTSIDER, role: "owner" } },
      },
    })
  ).id;
  orphanCompany = (
    await db.company.create({ data: { name: "Legacy unowned company" } })
  ).id;
  fixture = await createAuthFixture();
  owner = await fixture.token();
  member = await fixture.token(MEMBER);
  outsider = await fixture.token(OUTSIDER);
  app = buildApp(db, { security: fixture.security });
  await app.ready();
});
afterAll(async () => {
  await app?.close();
  await db?.$disconnect();
  if (directory) await rm(directory, { recursive: true, force: true });
});
describe("authentication on every company and calculation endpoint", () => {
  it.each(protectedRoutes)(
    "requires a bearer token: $method $url",
    async (options) => {
      const r = await app.inject(options);
      expect(r.statusCode).toBe(401);
      expect(r.json().error.code).toBe("UNAUTHENTICATED");
      expect(r.headers["www-authenticate"]).toBe("Bearer");
    },
  );
  it("keeps health public without disclosing company data", async () => {
    const r = await app.inject({ url: "/api/v1/health" });
    expect(r.statusCode).toBe(200);
    expect(r.json().data).toEqual({
      status: "ok",
      securityMode: "local",
      version: "v1",
    });
  });
  it("accepts a signed valid user token", async () => {
    const r = await request(owner, { url: "/api/v1/auth/me" });
    expect(r.statusCode).toBe(200);
    expect(r.json().data).toEqual({ userId: OWNER });
  });
  it.each([
    "Bearer invalid",
    "Basic credentials",
    "Bearer a.b.c",
    "Bearer a.b.c, Bearer d.e.f",
  ])("rejects malformed authorization %s", async (authorization) => {
    const r = await app.inject({
      url: "/api/v1/companies",
      headers: { authorization },
    });
    expect(r.statusCode).toBe(401);
    expect(r.body).not.toContain(authorization);
  });
  it("rejects expired, future, wrong-issuer, wrong-audience and missing-claim tokens", async () => {
    const now = Math.floor(Date.now() / 1000);
    for (const claims of [
      { exp: now - 30 },
      { nbf: now + 3600 },
      { iat: now + 3600, exp: now + 7200 },
      { iss: "https://wrong.example/auth/v1" },
      { aud: "anon" },
      { exp: undefined },
      { sub: undefined },
      { iat: undefined },
      { role: "service_role" },
      { role: "anon" },
      { is_anonymous: true },
    ]) {
      const token = await fixture.token(OWNER, claims);
      const r = await request(token, { url: "/api/v1/companies" });
      expect(r.statusCode).toBe(401);
      expect(r.body).not.toContain(token);
    }
  });
  it("rejects an unknown signing key, tampered signature and HS256 tokens", async () => {
    const other = await createAuthFixture();
    expect(
      (await request(await other.token(), { url: "/api/v1/companies" }))
        .statusCode,
    ).toBe(401);
    const parts = owner.split(".");
    parts[2] = (parts[2][0] === "A" ? "B" : "A") + parts[2].slice(1);
    expect(
      (await request(parts.join("."), { url: "/api/v1/companies" })).statusCode,
    ).toBe(401);
    const hs = await new SignJWT({ role: "authenticated" })
      .setSubject(OWNER)
      .setIssuer("http://localhost/packpilot-development")
      .setAudience("authenticated")
      .setIssuedAt()
      .setExpirationTime("1h")
      .setProtectedHeader({ alg: "HS256" })
      .sign(
        new TextEncoder().encode("not-a-production-secret-for-testing-only"),
      );
    expect((await request(hs, { url: "/api/v1/companies" })).statusCode).toBe(
      401,
    );
  });
  it("authenticates calculators without requiring a company or saving a scenario", async () => {
    const before = await db.productionScenario.count();
    const r = await request(outsider, {
      method: "POST",
      url: "/api/v1/calculations/packaging-costs",
      payload: createDemoScenario(),
    });
    expect(r.statusCode).toBe(200);
    expect(r.json().data.totalPackagingOperatingEuro).toBe("286");
    expect(await db.productionScenario.count()).toBe(before);
  });
});
describe("company authorization", () => {
  it.each(companyRoutes)(
    "denies another company: $method $url",
    async (options) => {
      const r = await request(outsider, options);
      expect(r.statusCode).toBe(404);
      expect(r.json().error.message).toBe("Company not found.");
    },
  );
  it("filters lists and pagination to the current membership", async () => {
    const a = await request(owner, { url: "/api/v1/companies" });
    expect(
      a.json().data.find((c: { id: string }) => c.id === "og-tofu")
        .membershipRole,
    ).toBe("owner");
    const memberList = await request(member, { url: "/api/v1/companies" });
    expect(
      memberList.json().data.find((c: { id: string }) => c.id === "og-tofu")
        .membershipRole,
    ).toBe("member");
    expect(a.json().data[0]).not.toHaveProperty("memberships");
    const b = await request(outsider, {
      url: "/api/v1/companies?limit=1&offset=0",
    });
    expect(a.json().data.map((c: { id: string }) => c.id)).toContain("og-tofu");
    expect(a.json().data.map((c: { id: string }) => c.id)).not.toContain(
      otherCompany,
    );
    expect(a.json().data.map((c: { id: string }) => c.id)).not.toContain(
      orphanCompany,
    );
    expect(b.json().data.map((c: { id: string }) => c.id)).toEqual([
      otherCompany,
    ]);
  });
  it.each(collections)("allows members to list company %s", async (c) => {
    expect(
      (await request(member, { url: `/api/v1/companies/og-tofu/${c}` }))
        .statusCode,
    ).toBe(200);
  });
  it("allows members to create, edit and delete operational records", async () => {
    const created = await request(member, {
      method: "POST",
      url: "/api/v1/companies/og-tofu/products",
      payload: { name: "Member product" },
    });
    expect(created.statusCode).toBe(201);
    const url = `/api/v1/companies/og-tofu/products/${created.json().data.id}`;
    expect(
      (
        await request(member, {
          method: "PATCH",
          url,
          payload: { name: "Edited" },
        })
      ).statusCode,
    ).toBe(200);
    expect((await request(member, { method: "DELETE", url })).statusCode).toBe(
      204,
    );
  });
  it("blocks member company administration and membership management", async () => {
    for (const options of [
      {
        method: "PATCH" as const,
        url: "/api/v1/companies/og-tofu",
        payload: { name: "No" },
      },
      { method: "DELETE" as const, url: "/api/v1/companies/og-tofu" },
      { method: "GET" as const, url: "/api/v1/companies/og-tofu/memberships" },
      {
        method: "POST" as const,
        url: "/api/v1/companies/og-tofu/memberships",
        payload: { userId: MEMBER, role: "owner" },
      },
      {
        method: "PATCH" as const,
        url: `/api/v1/companies/og-tofu/memberships/${MEMBER}`,
        payload: { role: "owner" },
      },
      {
        method: "DELETE" as const,
        url: `/api/v1/companies/og-tofu/memberships/${OWNER}`,
      },
    ])
      expect((await request(member, options)).statusCode).toBe(403);
  });
  it("does not trust identity headers, user metadata, or company IDs in the body", async () => {
    const spoof = await fixture.token(MEMBER, {
      user_metadata: { role: "owner" },
      app_metadata: { companyId: otherCompany, role: "owner" },
    });
    expect(
      (
        await request(spoof, {
          method: "PATCH",
          url: "/api/v1/companies/og-tofu",
          payload: { name: "No" },
          headers: { "x-user-id": OWNER },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await request(owner, {
          method: "POST",
          url: "/api/v1/companies",
          payload: {
            name: "No",
            memberships: [{ userId: OWNER, role: "owner" }],
          },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await app.inject({
          url: "/api/v1/companies",
          headers: { "x-user-id": OWNER, cookie: `access_token=${owner}` },
        })
      ).statusCode,
    ).toBe(401);
  });
  it("cannot read a foreign record through an authorized company path", async () => {
    expect(
      (
        await request(outsider, {
          url: `/api/v1/companies/${otherCompany}/products/og-fresh-tofu`,
        })
      ).statusCode,
    ).toBe(404);
  });
  it("never lets the first authenticated visitor claim a legacy company", async () => {
    expect(
      (await request(owner, { url: `/api/v1/companies/${orphanCompany}` }))
        .statusCode,
    ).toBe(404);
    expect(
      await db.companyMembership.count({ where: { companyId: orphanCompany } }),
    ).toBe(0);
    await bootstrapOwner(db, orphanCompany, OWNER);
    expect(
      (await request(owner, { url: `/api/v1/companies/${orphanCompany}` }))
        .statusCode,
    ).toBe(200);
    await expect(bootstrapOwner(db, orphanCompany, OUTSIDER)).rejects.toThrow(
      /already has memberships/,
    );
  });
});
describe("owner membership administration", () => {
  it("creates a company and its initial owner atomically", async () => {
    const id = await createCompany();
    expect(
      await db.companyMembership.findUnique({
        where: { companyId_userId: { companyId: id, userId: OWNER } },
      }),
    ).toMatchObject({ role: "owner" });
  });
  it("adds, changes and revokes memberships; revoked tokens lose access immediately on the next request", async () => {
    const id = await createCompany(),
      path = `/api/v1/companies/${id}/memberships`;
    expect(
      (
        await request(owner, {
          method: "POST",
          url: path,
          payload: { userId: MEMBER, role: "member" },
        })
      ).statusCode,
    ).toBe(201);
    expect(
      (await request(member, { url: `/api/v1/companies/${id}` })).statusCode,
    ).toBe(200);
    expect(
      (
        await request(owner, {
          method: "PATCH",
          url: `${path}/${MEMBER}`,
          payload: { role: "owner" },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await request(member, {
          method: "PATCH",
          url: `/api/v1/companies/${id}`,
          payload: { name: "New owner edit" },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await request(owner, { method: "DELETE", url: `${path}/${MEMBER}` }))
        .statusCode,
    ).toBe(204);
    expect(
      (await request(member, { url: `/api/v1/companies/${id}` })).statusCode,
    ).toBe(404);
  });
  it("rejects removing or demoting the final owner", async () => {
    const id = await createCompany(),
      url = `/api/v1/companies/${id}/memberships/${OWNER}`;
    expect((await request(owner, { method: "DELETE", url })).statusCode).toBe(
      409,
    );
    expect(
      (
        await request(owner, {
          method: "PATCH",
          url,
          payload: { role: "member" },
        })
      ).statusCode,
    ).toBe(409);
    expect(
      await db.companyMembership.count({
        where: { companyId: id, role: "owner" },
      }),
    ).toBe(1);
  });
  it("permits ownership handover and blocks administration by the demoted owner", async () => {
    const id = await createCompany(),
      path = `/api/v1/companies/${id}/memberships`,
      second = await fixture.token(SECOND_OWNER);
    expect(
      (
        await request(owner, {
          method: "POST",
          url: path,
          payload: { userId: SECOND_OWNER, role: "owner" },
        })
      ).statusCode,
    ).toBe(201);
    expect(
      (
        await request(owner, {
          method: "PATCH",
          url: `${path}/${OWNER}`,
          payload: { role: "member" },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await request(owner, {
          method: "DELETE",
          url: `${path}/${SECOND_OWNER}`,
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await request(second, {
          method: "DELETE",
          url: `/api/v1/companies/${id}`,
        })
      ).statusCode,
    ).toBe(204);
    expect(await db.companyMembership.count({ where: { companyId: id } })).toBe(
      0,
    );
  });
  it("validates membership roles and UUIDs and prevents duplicates", async () => {
    const id = await createCompany(),
      url = `/api/v1/companies/${id}/memberships`;
    expect(
      (
        await request(owner, {
          method: "POST",
          url,
          payload: { userId: OWNER, role: "owner" },
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await request(owner, {
          method: "POST",
          url,
          payload: { userId: "invalid", role: "owner" },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (
        await request(owner, {
          method: "POST",
          url,
          payload: { userId: MEMBER, role: "admin" },
        })
      ).statusCode,
    ).toBe(400);
    await expect(
      db.companyMembership.create({
        data: { companyId: id, userId: MEMBER, role: "admin" },
      }),
    ).rejects.toThrow();
  });
});
describe("browser origin boundary", () => {
  it("permits an exact allowed origin and returns CORS headers on authenticated requests", async () => {
    const r = await request(owner, {
      url: "/api/v1/companies",
      headers: { origin: "http://localhost:5173" },
    });
    expect(r.statusCode).toBe(200);
    expect(r.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5173",
    );
    expect(r.headers["access-control-allow-credentials"]).toBeUndefined();
  });
  it("allows preflight without a token while the real request still requires one", async () => {
    const r = await app.inject({
      method: "OPTIONS",
      url: "/api/v1/companies",
      headers: {
        origin: "http://localhost:5173",
        "access-control-request-method": "POST",
        "access-control-request-headers": "authorization,content-type",
      },
    });
    expect(r.statusCode).toBe(204);
    expect(
      (
        await app.inject({
          url: "/api/v1/companies",
          headers: { origin: "http://localhost:5173" },
        })
      ).statusCode,
    ).toBe(401);
  });
  it("rejects lookalike origins and unapproved hosts", async () => {
    expect(
      (
        await request(owner, {
          url: "/api/v1/companies",
          headers: { origin: "http://localhost:5173.evil.example" },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await request(owner, {
          url: "/api/v1/companies",
          headers: { host: "localhost@evil.example" },
        })
      ).statusCode,
    ).toBe(403);
  });
});
