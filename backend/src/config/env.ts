import "dotenv/config";
import { isAbsolute } from "node:path";
import { z } from "zod";
const baseSchema = z.object({
  DATABASE_URL: z.string().startsWith("file:").default("file:./dev.db"),
  HOST: z.enum(["127.0.0.1", "::1", "0.0.0.0", "::"]).default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  LOG_LEVEL: z
    .enum(["silent", "error", "warn", "info", "debug"])
    .default("info"),
});
// An omitted production URL must not create an ephemeral working-directory database.
function requireProductionDatabase(env: NodeJS.ProcessEnv) {
  if (env.NODE_ENV !== "production") return;
  const url = env.DATABASE_URL;
  const file = url?.startsWith("file:") ? url.slice(5) : "";
  if (!file || !isAbsolute(file) || file.startsWith("//") || /[?#]/.test(file))
    throw new Error(
      "Production DATABASE_URL must be an explicit absolute SQLite file path on persistent storage, without URL parameters.",
    );
}
// Database commands do not need an identity provider configuration.
export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  requireProductionDatabase(env);
  return baseSchema.parse(env);
}
const serverSchema = baseSchema
  .extend({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    AUTH_MODE: z.enum(["supabase", "local"]).default("supabase"),
    SUPABASE_URL: z.url().optional(),
    ALLOWED_ORIGINS: z.string().default(""),
    ALLOWED_HOSTS: z.string().default("localhost,127.0.0.1,[::1]"),
  })
  .transform((c, ctx) => {
    const origins = c.ALLOWED_ORIGINS.split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const hosts = c.ALLOWED_HOSTS.split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const issue = (message: string) =>
      ctx.addIssue({ code: "custom", message });
    for (const origin of origins) {
      try {
        const u = new URL(origin);
        if (
          origin.includes("*") ||
          u.origin !== origin ||
          !(
            u.protocol === "https:" ||
            (c.NODE_ENV !== "production" &&
              ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname) &&
              u.protocol === "http:")
          )
        )
          issue(
            "Allowed origins must be exact HTTPS origins (local HTTP is allowed outside production).",
          );
      } catch {
        issue("Invalid allowed origin.");
      }
    }
    if (
      !hosts.length ||
      hosts.some(
        (h) =>
          !/^(localhost|127\.0\.0\.1|\[::1\]|[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)$/.test(
            h,
          ),
      )
    )
      issue(
        "Allowed hosts must be exact hostnames without ports or wildcards.",
      );
    if (
      c.AUTH_MODE === "local" &&
      (c.NODE_ENV === "production" || !["127.0.0.1", "::1"].includes(c.HOST))
    )
      issue(
        "Local authentication requires a non-production environment and loopback binding.",
      );
    if (
      c.AUTH_MODE === "local" &&
      origins.some(
        (o) =>
          !["localhost", "127.0.0.1", "[::1]"].includes(new URL(o).hostname),
      )
    )
      issue("Local authentication only accepts local frontend origins.");
    let supabaseUrl = c.SUPABASE_URL?.replace(/\/$/, "");
    if (c.AUTH_MODE === "supabase") {
      if (!supabaseUrl)
        issue(
          "SUPABASE_URL is required; authentication never falls back to local mode.",
        );
      else {
        const u = new URL(supabaseUrl);
        if (
          u.username ||
          u.password ||
          u.search ||
          u.hash ||
          u.pathname !== "/" ||
          u.protocol !== "https:"
        )
          issue(
            "SUPABASE_URL must be an HTTPS project origin without credentials, path or query.",
          );
      }
    }
    return {
      ...c,
      SUPABASE_URL: supabaseUrl,
      ALLOWED_ORIGINS: origins,
      ALLOWED_HOSTS: hosts,
    };
  });
export function loadServerConfig(env: NodeJS.ProcessEnv = process.env) {
  requireProductionDatabase(env);
  return serverSchema.parse(env);
}
export type ServerConfig = ReturnType<typeof loadServerConfig>;
