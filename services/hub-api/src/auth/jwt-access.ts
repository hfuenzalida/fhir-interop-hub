import * as jose from "jose";
import type { Env } from "../env.js";
import {
  exportJwksJson,
  getJwtVerificationKey,
  hasJwtSigningMaterial,
  jwtKeyId,
} from "./jwt-keys.js";

export { exportJwksJson, hasJwtSigningMaterial, jwtKeyId };

function hsSecretKey(env: Env): Uint8Array | null {
  if (!env.HUB_JWT_SECRET) return null;
  return new TextEncoder().encode(env.HUB_JWT_SECRET);
}

async function signJwt(
  env: Env,
  claims: Record<string, string>,
  subject: string,
  audience: string,
  expiry: string,
): Promise<string> {
  if (env.HUB_JWT_PRIVATE_KEY_PEM) {
    const key = await jose.importPKCS8(env.HUB_JWT_PRIVATE_KEY_PEM.trim(), "RS256");
    return new jose.SignJWT(claims)
      .setProtectedHeader({
        alg: "RS256",
        typ: "JWT",
        kid: jwtKeyId(env),
      })
      .setIssuer(env.oauthIssuer)
      .setAudience(audience)
      .setSubject(subject)
      .setExpirationTime(expiry)
      .setIssuedAt()
      .sign(key);
  }
  const key = hsSecretKey(env);
  if (!key) throw new Error("No JWT signing key configured");
  return new jose.SignJWT(claims)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(env.oauthIssuer)
    .setAudience(audience)
    .setSubject(subject)
    .setExpirationTime(expiry)
    .setIssuedAt()
    .sign(key);
}

export async function signHubAccessToken(
  env: Env,
  input: {
    clientId: string;
    tenantUuid: string;
    tenantExternalKey: string;
    patientLogicalId?: string;
    scope: string;
  },
): Promise<string> {
  const claims: Record<string, string> = {
    tenant_id: input.tenantUuid,
    tenant_key: input.tenantExternalKey,
    scope: input.scope,
  };
  if (input.patientLogicalId) claims.patient = input.patientLogicalId;
  return signJwt(
    env,
    claims,
    input.clientId,
    env.oauthAudience,
    "1h",
  );
}

/** OpenID Connect `id_token`: `aud` is the OAuth client_id. */
export async function signOpenIdToken(
  env: Env,
  input: {
    clientId: string;
    /** Typically Patient/{id} absolute URL for SMART patient launch. */
    subject: string;
    nonce?: string;
    fhirUserUrl?: string;
  },
): Promise<string> {
  const claims: Record<string, string> = {};
  if (input.nonce) claims.nonce = input.nonce;
  if (input.fhirUserUrl) claims.fhirUser = input.fhirUserUrl;
  return signJwt(
    env,
    claims,
    input.subject,
    input.clientId,
    "1h",
  );
}

export async function verifyHubAccessToken(
  env: Env,
  token: string,
): Promise<{
  tenantUuid: string;
  externalKey: string;
  patient?: string;
  scopes: string[];
  clientId: string;
} | null> {
  if (!hasJwtSigningMaterial(env)) return null;
  try {
    const { payload } = await jose.jwtVerify(token, async (header) =>
      getJwtVerificationKey(env, header),
      {
        issuer: env.oauthIssuer,
        audience: env.oauthAudience,
        algorithms: ["HS256", "RS256"],
      },
    );
    const tenant_id = payload.tenant_id;
    const tenant_key = payload.tenant_key;
    const scope = payload.scope;
    const sub = payload.sub;
    if (
      typeof tenant_id !== "string" ||
      typeof tenant_key !== "string" ||
      typeof scope !== "string" ||
      typeof sub !== "string"
    ) {
      return null;
    }
    const patient =
      typeof payload.patient === "string" ? payload.patient : undefined;
    const scopes = scope.split(/\s+/).filter(Boolean);
    return {
      tenantUuid: tenant_id,
      externalKey: tenant_key,
      patient,
      scopes,
      clientId: sub,
    };
  } catch {
    return null;
  }
}
