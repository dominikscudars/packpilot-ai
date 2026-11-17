import "dotenv/config";
import { z } from "zod";
const envSchema = z.object({
  DATABASE_URL: z.string().startsWith("file:").default("file:./dev.db"),
  HOST: z.enum(["127.0.0.1", "::1"]).default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  LOG_LEVEL: z
    .enum(["silent", "error", "warn", "info", "debug"])
    .default("info"),
});
export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  return envSchema.parse(env);
}
