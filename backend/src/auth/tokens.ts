import {
  createLocalJWKSet,
  createRemoteJWKSet,
  jwtVerify,
  type JSONWebKeySet,
  type JWTVerifyGetKey,
} from "jose";
import { z } from "zod";
export const LOCAL_ISSUER = "http://localhost/packpilot-development";
export interface Principal {
  userId: string;
}
export type TokenVerifier = (token: string) => Promise<Principal>;
const claimsSchema = z.object({
  sub: z.uuid(),
  role: z.literal("authenticated"),
  is_anonymous: z.literal(false).optional(),
});
/** A signature alone is insufficient: issuer, audience, expiry and user role are mandatory. */
export function createTokenVerifier(
  issuer: string,
  keys: JWTVerifyGetKey,
): TokenVerifier {
  return async (token) => {
    const { payload } = await jwtVerify(token, keys, {
      issuer,
      audience: "authenticated",
      algorithms: ["ES256", "RS256"],
      requiredClaims: ["sub", "exp", "iat", "role"],
      clockTolerance: 5,
    });
    if (
      typeof payload.iat !== "number" ||
      typeof payload.exp !== "number" ||
      payload.iat > Date.now() / 1000 + 5 ||
      payload.exp <= payload.iat
    )
      throw new Error("Invalid token lifetime");
    const claims = claimsSchema.parse(payload);
    return { userId: claims.sub.toLowerCase() };
  };
}
export function createSupabaseVerifier(supabaseUrl: string): TokenVerifier {
  const issuer = `${supabaseUrl}/auth/v1`;
  return createTokenVerifier(
    issuer,
    createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`), {
      timeoutDuration: 5000,
      cooldownDuration: 30000,
      cacheMaxAge: 600000,
    }),
  );
}
export function createLocalVerifier(jwks: JSONWebKeySet): TokenVerifier {
  return createTokenVerifier(LOCAL_ISSUER, createLocalJWKSet(jwks));
}
