import { mkdir, open } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { loadConfig } from "../src/config/env.js";
const config = loadConfig();
const backendRoot = fileURLToPath(new URL("..", import.meta.url));
const file = config.DATABASE_URL.slice(5);
if (!file || file.includes("?") || file.includes(":memory:"))
  throw new Error(
    "Migrations require a local SQLite file path without query parameters.",
  );
const databasePath = resolve(backendRoot, "prisma", file);
await mkdir(dirname(databasePath), { recursive: true });
// Opening in append mode creates a missing file without truncating existing data.
await (await open(databasePath, "a")).close();
const result = spawnSync(
  process.execPath,
  [
    resolve(backendRoot, "node_modules/prisma/build/index.js"),
    "migrate",
    "deploy",
  ],
  {
    cwd: backendRoot,
    env: { ...process.env, DATABASE_URL: `file:${databasePath}` },
    stdio: "inherit",
  },
);
process.exitCode = result.status ?? 1;
