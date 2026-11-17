import { PrismaClient } from "@prisma/client";
import { loadConfig } from "./config/env.js";
import { buildApp } from "./app.js";
const config = loadConfig();
const db = new PrismaClient({ datasourceUrl: config.DATABASE_URL });
const app = buildApp(db, {
  level: config.LOG_LEVEL,
  redact: ["req.headers.authorization", "req.headers.cookie"],
});
app.addHook("onClose", async () => db.$disconnect());
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    void app.close();
  });
try {
  await db.$connect();
  await app.listen({ host: config.HOST, port: config.PORT });
} catch {
  app.log.error(
    "Backend startup failed. Check local configuration and database migrations.",
  );
  await db.$disconnect();
  process.exitCode = 1;
}
