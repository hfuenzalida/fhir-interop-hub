import { createPrivateKey, createPublicKey } from "node:crypto";
import * as jose from "jose";
import type { Env } from "../env.js";

export function hasJwtSigningMaterial(env: Env): boolean {
  return Boolean(env.HUB_JWT_SECRET) || Boolean(env.HUB_JWT_PRIVATE_KEY_PEM);
}

/** Stable key id for JWKS and JWT kid header (rotation: change env). */
export function jwtKeyId(env: Env): string {
  return env.HUB_JWT_KID ?? "hub-key-1";
}

type RsaImport = Awaited<ReturnType<typeof jose.importSPKI>>;

async function rs256PublicFromPrivatePem(pem: string): Promise<RsaImport> {
  const priv = createPrivateKey({ key: pem.trim(), format: "pem" });
  const pub = createPublicKey(priv);
  const spki = pub.export({ type: "spki", format: "pem" });
  if (typeof spki !== "string") {
    throw new Error("Expected PEM public key export");
  }
  return jose.importSPKI(spki, "RS256");
}

export async function exportJwksJson(env: Env): Promise<{
  keys: Record<string, unknown>[];
} | null> {
  if (env.HUB_JWT_PUBLIC_KEY_PEM) {
    const pub = await jose.importSPKI(env.HUB_JWT_PUBLIC_KEY_PEM.trim(), "RS256");
    const jwk = {
      ...(await jose.exportJWK(pub)),
      use: "sig",
      alg: "RS256",
      kid: jwtKeyId(env),
    };
    return { keys: [jwk] };
  }
  if (!env.HUB_JWT_PRIVATE_KEY_PEM) return null;
  const pub = await rs256PublicFromPrivatePem(env.HUB_JWT_PRIVATE_KEY_PEM);
  const jwk = {
    ...(await jose.exportJWK(pub)),
    use: "sig",
    alg: "RS256",
    kid: jwtKeyId(env),
  };
  return { keys: [jwk] };
}

/** Verification key resolver for jose.jwtVerify dynamic callback. */
export async function getJwtVerificationKey(
  env: Env,
  protectedHeader: jose.JWTHeaderParameters,
): Promise<RsaImport | Uint8Array> {
  const alg = protectedHeader.alg;
  if (alg === "HS256") {
    if (!env.HUB_JWT_SECRET) throw new Error("HS256 token but HUB_JWT_SECRET unset");
    return new TextEncoder().encode(env.HUB_JWT_SECRET);
  }
  if (alg === "RS256") {
    if (env.HUB_JWT_PUBLIC_KEY_PEM) {
      return jose.importSPKI(env.HUB_JWT_PUBLIC_KEY_PEM.trim(), "RS256");
    }
    if (env.HUB_JWT_PRIVATE_KEY_PEM) {
      return rs256PublicFromPrivatePem(env.HUB_JWT_PRIVATE_KEY_PEM);
    }
    throw new Error("RS256 token but no RSA public/private PEM configured");
  }
  throw new Error(`Unsupported JWT alg: ${String(alg)}`);
}
