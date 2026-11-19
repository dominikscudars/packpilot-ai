import { assertDatabaseReady } from "./shared/readiness.js";
import { PrismaClient } from "@prisma/client";
import { loadServerConfig } from "./config/env.js";
import { createSecurity } from "./auth/runtime.js";
import { buildApp } from "./app.js";
const config = loadServerConfig();
const db = new PrismaClient({ datasourceUrl: config.DATABASE_URL });
const app = buildApp(db, {
  security: await createSecurity(config),
  logger: {
    level: config.LOG_LEVEL,
    redact: ["req.headers.authorization", "req.headers.cookie"],
  },
});
app.addHook("onClose", async () => db.$disconnect());
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    void app.close();
  });
try {
  await db.$connect();
  await assertDatabaseReady(db);
  await app.listen({ host: config.HOST, port: config.PORT });
} catch {
  app.log.error(
    "Backend startup failed. Check local configuration and database migrations.",
  );
  await db.$disconnect();
  process.exitCode = 1;
}
