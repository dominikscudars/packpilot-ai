// Node 24's SQLite backup API copies a consistent snapshot, including WAL data.
import { DatabaseSync, backup } from "node:sqlite";
import { mkdir, open, rm } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../dist/src/config/env.js";
const url = loadConfig().DATABASE_URL;
if (url.includes("?") || url.includes("#") || url.includes(":memory:"))
  throw new Error("Backup requires a normal SQLite file URL.");
const sourcePath = resolve(
  fileURLToPath(new URL("../prisma/", import.meta.url)),
  url.slice(5),
);
const target = process.argv[2];
if (!target || !isAbsolute(target) || resolve(target) === sourcePath)
  throw new Error("Usage: npm run db:backup -- <new-absolute-backup-file>");
const source = new DatabaseSync(sourcePath, { readOnly: true });
let created = false;
try {
  await mkdir(dirname(target), { recursive: true });
  await (await open(target, "wx", 0o600)).close();
  created = true;
  await backup(source, target);
  const snapshot = new DatabaseSync(target, { readOnly: true });
  try {
    if (
      snapshot.prepare("PRAGMA integrity_check").get()?.integrity_check !== "ok"
    )
      throw new Error("Backup integrity check failed.");
  } finally {
    snapshot.close();
  }
  console.log(
    "SQLite snapshot created and integrity checked. Copy it off-host and verify a restore before pruning older backups.",
  );
} catch (error) {
  if (created) await rm(target, { force: true });
  throw error;
} finally {
  source.close();
}
