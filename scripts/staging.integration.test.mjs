// Offline rehearsal of the documented native Node staging commands. No deployment.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, copyFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { setTimeout as pause } from "node:timers/promises";
import { createAuthFixture, OWNER } from "../backend/tests/authFixture.ts";
const backendRoot = fileURLToPath(new URL("../backend/", import.meta.url));
const issuer = "https://staging-fixture.supabase.co/auth/v1";
let directory, fixture, preload, token;
before(async () => {
  directory = await mkdtemp(join(tmpdir(), "packpilot-staging-"));
  fixture = await createAuthFixture();
  token = await fixture.token(OWNER, { iss: issuer });
  preload = join(directory, "jwks-transport.mjs");
  // Only the test subprocess imports this transport fixture. Production source has no test switch.
  await writeFile(
    preload,
    `const realFetch = globalThis.fetch; globalThis.fetch = async (url, init) => String(url) === ${JSON.stringify(`${issuer}/.well-known/jwks.json`)} ? new Response(${JSON.stringify(JSON.stringify(fixture.jwks))}, { status: 200, headers: { 'content-type': 'application/json' } }) : realFetch(url, init);`,
  );
});
after(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
});
function env(databasePath) {
  return {
    ...process.env,
    NODE_ENV: "production",
    AUTH_MODE: "supabase",
    SUPABASE_URL: "https://staging-fixture.supabase.co",
    DATABASE_URL: `file:${databasePath}`,
    HOST: "127.0.0.1",
    PORT: "3001",
    ALLOWED_HOSTS: "127.0.0.1",
    ALLOWED_ORIGINS: "https://staging.example.test",
    LOG_LEVEL: "silent",
  };
}
function command(args, environment) {
  return execFileSync(process.execPath, args, {
    cwd: backendRoot,
    env: environment,
    stdio: "pipe",
    timeout: 30000,
  });
}
async function start(environment) {
  const reservation = createServer();
  await new Promise((resolve) => reservation.listen(0, "127.0.0.1", resolve));
  const address = reservation.address();
  assert.ok(address && typeof address !== "string");
  const port = address.port;
  await new Promise((resolve) => reservation.close(resolve));
  const child = spawn(
    process.execPath,
    ["--import", preload, "dist/src/server.js"],
    {
      cwd: backendRoot,
      env: { ...environment, PORT: String(port) },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let exited = false;
  const done = new Promise((resolve) =>
    child.once("exit", () => {
      exited = true;
      resolve();
    }),
  );
  const origin = `http://127.0.0.1:${port}`;
  async function stop() {
    if (!exited) child.kill("SIGTERM");
    await done;
  }
  try {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (exited)
        throw new Error("Compiled staging server exited before readiness.");
      const response = await fetch(`${origin}/api/v1/health`).catch(() => null);
      if (response?.ok) return { origin, stop };
      await pause(50);
    }
    throw new Error("Staging server readiness timed out.");
  } catch (error) {
    await stop();
    throw error;
  }
}
test("compiled production server refuses an unmigrated database", async () => {
  const result = spawnSync(
    process.execPath,
    ["--import", preload, "dist/src/server.js"],
    {
      cwd: backendRoot,
      env: env(join(directory, "empty.db")),
      stdio: "pipe",
      timeout: 10000,
    },
  );
  assert.equal(result.status, 1);
});
test("production startup, ownership, persistent restart, live backup and isolated restore", async () => {
  const source = join(directory, "mounted", "staging.db");
  const environment = env(source);
  command(["--import", "tsx", "scripts/migrate.ts"], environment);
  command(["dist/prisma/seed.js"], environment);
  command(
    ["--import", "tsx", "scripts/bootstrapOwner.ts", "og-tofu", OWNER],
    environment,
  );
  let server = await start(environment);
  async function request(path, method = "GET", body) {
    return fetch(`${server.origin}/api/v1/${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Origin: "https://staging.example.test",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  }
  try {
    assert.equal(
      (await fetch(`${server.origin}/api/v1/companies`)).status,
      401,
    );
    const preflight = await fetch(`${server.origin}/api/v1/companies`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://staging.example.test",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "authorization",
      },
    });
    assert.equal(preflight.status, 204);
    assert.equal(
      preflight.headers.get("access-control-allow-origin"),
      "https://staging.example.test",
    );
    const companies = await request("companies");
    assert.equal(companies.status, 200);
    assert.equal(companies.headers.get("cache-control"), "no-store");
    assert.equal((await companies.json()).data[0].membershipRole, "owner");
    assert.equal(
      (
        await request("companies/og-tofu", "PATCH", {
          name: "Persisted before backup",
        })
      ).status,
      200,
    );
    const snapshot = join(directory, "backups", "staging.snapshot.db");
    command(["scripts/backupDatabase.mjs", snapshot], environment);
    const originalBytes = await readFile(snapshot);
    const repeat = spawnSync(
      process.execPath,
      ["scripts/backupDatabase.mjs", snapshot],
      { cwd: backendRoot, env: environment, stdio: "pipe" },
    );
    assert.equal(repeat.status, 1);
    assert.deepEqual(await readFile(snapshot), originalBytes);
    assert.equal(
      (
        await request("companies/og-tofu", "PATCH", {
          name: "Persisted after backup",
        })
      ).status,
      200,
    );
    await server.stop();
    server = await start(environment);
    assert.equal(
      (await (await request("companies")).json()).data[0].name,
      "Persisted after backup",
    );
    await server.stop();
    const restored = join(directory, "isolated-restore.db");
    await copyFile(snapshot, restored);
    server = await start(env(restored));
    const restoredCompanies = (await (await request("companies")).json()).data;
    assert.equal(restoredCompanies[0].name, "Persisted before backup");
    assert.equal(restoredCompanies[0].membershipRole, "owner");
    const scenario = (
      await (await request("companies/og-tofu/scenarios")).json()
    ).data[0];
    const calculated = await request(
      "calculations/packaging-costs",
      "POST",
      scenario.input,
    );
    assert.equal(calculated.status, 200);
    assert.equal(
      (await calculated.json()).data.totalPackagingOperatingEuro,
      "286",
    );
  } finally {
    await server.stop();
  }
});
