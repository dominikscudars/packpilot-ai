import { readFile } from "node:fs/promises";
import { z } from "zod";
import { createSupabaseVerifier, createLocalVerifier } from "./tokens.js";
import type { SecurityOptions } from "./access.js";
import type { ServerConfig } from "../config/env.js";
export async function createSecurity(
  config: ServerConfig,
): Promise<SecurityOptions> {
  let verifyToken;
  if (config.AUTH_MODE === "supabase")
    verifyToken = createSupabaseVerifier(config.SUPABASE_URL!);
  else {
    const jwks = z
      .object({
        keys: z
          .array(
            z
              .object({
                kty: z.literal("EC"),
                crv: z.literal("P-256"),
                x: z.string(),
                y: z.string(),
                kid: z.string(),
                alg: z.literal("ES256"),
              })
              .strict(),
          )
          .min(1),
      })
      .parse(JSON.parse(await readFile(".auth/public.jwks.json", "utf8")));
    verifyToken = createLocalVerifier(jwks);
  }
  return {
    mode: config.AUTH_MODE,
    verifyToken,
    allowedOrigins: config.ALLOWED_ORIGINS,
    allowedHosts: config.ALLOWED_HOSTS,
  };
}
