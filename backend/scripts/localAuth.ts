import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { generateKeyPair, exportJWK, importJWK, SignJWT } from "jose";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { loadServerConfig } from "../src/config/env.js";
import { LOCAL_ISSUER } from "../src/auth/tokens.js";
const config = loadServerConfig();
if (config.AUTH_MODE !== "local")
  throw new Error("Development keys/tokens require AUTH_MODE=local.");
const command = process.argv[2];
if (command === "setup") {
  await mkdir(".auth", { recursive: true, mode: 0o700 });
  let exists = false;
  try {
    await access(".auth/private.jwk.json");
    exists = true;
  } catch {}
  if (exists) {
    await access(".auth/public.jwks.json");
    console.log("Local authentication keys already exist; preserved.");
  } else {
    const { publicKey, privateKey } = await generateKeyPair("ES256", {
      extractable: true,
    });
    const kid = randomUUID();
    const publicJwk = { ...(await exportJWK(publicKey)), kid, alg: "ES256" };
    const privateJwk = { ...(await exportJWK(privateKey)), kid, alg: "ES256" };
    await writeFile(".auth/private.jwk.json", JSON.stringify(privateJwk), {
      flag: "wx",
      mode: 0o600,
    });
    await writeFile(
      ".auth/public.jwks.json",
      JSON.stringify({ keys: [publicJwk] }),
      { flag: "wx", mode: 0o600 },
    );
    console.log(
      "Created ignored local development signing keys. These cannot authenticate against Supabase.",
    );
  }
} else if (command === "token") {
  const userId = z.uuid().parse(process.argv[3]).toLowerCase();
  const jwk = JSON.parse(await readFile(".auth/private.jwk.json", "utf8"));
  const key = await importJWK(jwk, "ES256");
  console.log(
    await new SignJWT({ role: "authenticated", is_anonymous: false })
      .setProtectedHeader({ alg: "ES256", kid: jwk.kid, typ: "JWT" })
      .setIssuer(LOCAL_ISSUER)
      .setAudience("authenticated")
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(key),
  );
} else throw new Error("Use setup or token <development-user-uuid>.");
