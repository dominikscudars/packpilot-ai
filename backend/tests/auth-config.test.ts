import { afterEach, describe, it, expect, vi } from "vitest";
import { SignJWT } from "jose";
import { loadConfig, loadServerConfig } from "../src/config/env.js";
import { createSupabaseVerifier } from "../src/auth/tokens.js";
import { createAuthFixture, OWNER } from "./authFixture.js";
afterEach(() => vi.unstubAllGlobals());
describe("production configuration fails closed", () => {
  it("requires Supabase configuration by default", () => {
    expect(() => loadServerConfig({})).toThrow();
    expect(() => loadServerConfig({ AUTH_MODE: "supabase" })).toThrow();
  });
  it("never enables local authentication in production or on a public bind address", () => {
    expect(() =>
      loadServerConfig({
        NODE_ENV: "production",
        DATABASE_URL: "file:/var/data/test.db",
        AUTH_MODE: "local",
      }),
    ).toThrow();
    expect(() =>
      loadServerConfig({ AUTH_MODE: "local", HOST: "0.0.0.0" }),
    ).toThrow();
    expect(() =>
      loadServerConfig({
        AUTH_MODE: "local",
        ALLOWED_ORIGINS: "https://public.example",
      }),
    ).toThrow();
  });
  it("rejects unsafe Supabase and frontend origins", () => {
    for (const url of [
      "http://project.supabase.co",
      "https://project.supabase.co/path",
      "https://user:pass@project.supabase.co",
    ])
      expect(() => loadServerConfig({ SUPABASE_URL: url })).toThrow();
    for (const origin of [
      "*",
      "https://*.example.com",
      "https://app.example.com/path",
      "null",
      "http://app.example.com",
    ])
      expect(() =>
        loadServerConfig({
          NODE_ENV: "production",
          DATABASE_URL: "file:/var/data/test.db",
          SUPABASE_URL: "https://project.supabase.co",
          ALLOWED_ORIGINS: origin,
        }),
      ).toThrow();
  });
  it("accepts an explicit Supabase deployment configuration without privileged keys", () => {
    expect(
      loadServerConfig({
        NODE_ENV: "production",
        DATABASE_URL: "file:/var/data/test.db",
        AUTH_MODE: "supabase",
        SUPABASE_URL: "https://project.supabase.co/",
        HOST: "0.0.0.0",
        ALLOWED_ORIGINS: "https://packpilot.example",
        ALLOWED_HOSTS: "api.packpilot.example",
      }),
    ).toMatchObject({
      SUPABASE_URL: "https://project.supabase.co",
      ALLOWED_ORIGINS: ["https://packpilot.example"],
    });
  });
});
describe("Supabase JWKS verification without a cloud account", () => {
  it("fetches only the configured project JWKS and verifies a signed access token", async () => {
    const f = await createAuthFixture();
    const fetchMock = vi.fn(
      async (_input: string | URL | Request) =>
        new Response(JSON.stringify(f.jwks), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const verify = createSupabaseVerifier(
      "https://example-project.supabase.co",
    );
    const token = await new SignJWT({
      role: "authenticated",
      is_anonymous: false,
    })
      .setProtectedHeader({ alg: "ES256", kid: "test-key" })
      .setSubject(OWNER)
      .setIssuer("https://example-project.supabase.co/auth/v1")
      .setAudience("authenticated")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(f.privateKey);
    expect(await verify(token)).toEqual({ userId: OWNER });
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://example-project.supabase.co/auth/v1/.well-known/jwks.json",
    );
    await verify(token);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("does not fall back when the JWKS endpoint fails", async () => {
    const f = await createAuthFixture();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Unavailable", { status: 503 })),
    );
    const verify = createSupabaseVerifier(
      "https://example-project.supabase.co",
    );
    await expect(verify(await f.token())).rejects.toThrow();
  });
});

describe("production database configuration", () => {
  it.each([
    undefined,
    "file:./dev.db",
    "file::memory:",
    "file:/var/data/db.sqlite?mode=memory",
  ])("rejects an implicit/relative/ephemeral database: %s", (DATABASE_URL) => {
    const env = {
      NODE_ENV: "production",
      SUPABASE_URL: "https://project.supabase.co",
      DATABASE_URL,
    };
    expect(() => loadConfig(env)).toThrow(/DATABASE_URL/);
    expect(() => loadServerConfig(env)).toThrow(/DATABASE_URL/);
  });
  it("accepts an explicitly configured absolute database and retains local defaults", () => {
    expect(
      loadConfig({
        NODE_ENV: "production",
        DATABASE_URL: "file:/var/data/packpilot/staging.db",
      }).DATABASE_URL,
    ).toBe("file:/var/data/packpilot/staging.db");
    expect(loadConfig({}).DATABASE_URL).toBe("file:./dev.db");
  });
});
