import {
  generateKeyPair,
  exportJWK,
  SignJWT,
  createLocalJWKSet,
  type JWTPayload,
} from "jose";
import { createTokenVerifier, LOCAL_ISSUER } from "../src/auth/tokens.js";
import type { SecurityOptions } from "../src/auth/access.js";
export const OWNER = "11111111-1111-4111-8111-111111111111";
export const MEMBER = "22222222-2222-4222-8222-222222222222";
export const OUTSIDER = "33333333-3333-4333-8333-333333333333";
export const SECOND_OWNER = "44444444-4444-4444-8444-444444444444";
export async function createAuthFixture() {
  const { publicKey, privateKey } = await generateKeyPair("ES256");
  const publicJwk = {
    ...(await exportJWK(publicKey)),
    kid: "test-key",
    alg: "ES256",
  };
  const jwks = { keys: [publicJwk] };
  async function token(subject = OWNER, claims: JWTPayload = {}) {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({
      sub: subject,
      iss: LOCAL_ISSUER,
      aud: "authenticated",
      iat: now,
      exp: now + 3600,
      role: "authenticated",
      is_anonymous: false,
      ...claims,
    })
      .setProtectedHeader({ alg: "ES256", kid: "test-key", typ: "JWT" })
      .sign(privateKey);
  }
  const security: SecurityOptions = {
    mode: "local",
    verifyToken: createTokenVerifier(LOCAL_ISSUER, createLocalJWKSet(jwks)),
    allowedOrigins: ["http://localhost:5173"],
    allowedHosts: ["localhost", "127.0.0.1", "[::1]"],
  };
  return { token, security, jwks, privateKey };
}
