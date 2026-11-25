import { randomBytes, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { AuditEvent } from "@fhir-hub/shared";
import { emitAudit } from "../audit/emit-audit.js";
import type { AuditSink } from "../audit/sink.js";
import { sha256Hex } from "../auth/api-key.js";
import { resolveTenant } from "../auth/api-key.js";
import {
  exportJwksJson,
  hasJwtSigningMaterial,
  signHubAccessToken,
  signOpenIdToken,
} from "../auth/jwt-access.js";
import { verifyPkceS256 } from "../auth/pkce.js";
import type { Env } from "../env.js";
import { recordOAuthTokenIssued } from "../observability/prometheus-metrics.js";
import { TtlCache } from "../util/ttl-cache.js";

function audit(
  sink: AuditSink,
  request: FastifyRequest | undefined,
  input: Omit<AuditEvent, "id" | "timestamp">,
): Promise<void> {
  return emitAudit(sink, request, input);
}

function timingSafeSecretOk(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function jsonReply(reply: FastifyReply, code: number, body: unknown) {
  return reply.code(code).type("application/json").send(body);
}

const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const SMART_SCOPES_SUPPORTED = [
  "launch/patient",
  "openid",
  "profile",
  "fhirUser",
  "patient/Patient.rs",
  "patient/Patient.read",
  "patient/Patient.write",
  "patient/Observation.rs",
  "patient/Observation.read",
  "patient/Observation.write",
  "patient/Condition.rs",
  "patient/Condition.read",
  "patient/Condition.write",
  "patient/Encounter.rs",
  "patient/Encounter.read",
  "patient/Encounter.write",
  "patient/DocumentReference.rs",
  "patient/DocumentReference.read",
  "patient/DocumentReference.write",
  "patient/Consent.rs",
  "patient/Consent.read",
  "patient/Consent.write",
] as const;

async function authenticateOAuthClient(
  pool: Parameters<typeof resolveTenant>[0],
  client_id: string,
  client_secret: string | undefined,
): Promise<
  | {
      ok: true;
      tenant_id: string;
      is_public: boolean;
    }
  | { ok: false; status: 401 }
> {
  const clientR = await pool.query<{
    tenant_id: string;
    client_secret_hash: string;
    is_public: boolean;
  }>(
    `SELECT tenant_id, client_secret_hash, COALESCE(is_public, FALSE) AS is_public
     FROM oauth_client WHERE client_id = $1 LIMIT 1`,
    [client_id],
  );
  const row = clientR.rows[0];
  if (!row) return { ok: false, status: 401 };
  if (row.is_public) {
    return { ok: true, tenant_id: row.tenant_id, is_public: true };
  }
  const secret = client_secret ?? "";
  if (!secret) return { ok: false, status: 401 };
  const presented = sha256Hex(secret);
  if (!timingSafeSecretOk(presented, row.client_secret_hash)) {
    return { ok: false, status: 401 };
  }
  return { ok: true, tenant_id: row.tenant_id, is_public: false };
}

export async function registerSmartRoutes(
  app: FastifyInstance,
  opts: { env: Env; sink: AuditSink },
): Promise<void> {
  const pool = app.pg;
  if (!pool) {
    throw new Error("registerSmartRoutes requires DATABASE_URL (pg pool).");
  }
  const { env, sink } = opts;
  const discoveryCache = new TtlCache<unknown>(env.DISCOVERY_CACHE_TTL_MS);

  app.get("/.well-known/smart-configuration", async (_request, reply) => {
    const hit = discoveryCache.get("smart-configuration");
    if (hit !== undefined) return reply.send(hit);

    const issuerUrl = env.oauthIssuer.replace(/\/$/, "");
    const jwksDoc = await exportJwksJson(env);
    const jwks_uri = jwksDoc
      ? `${issuerUrl}/.well-known/jwks.json`
      : undefined;
    const body = {
      issuer: issuerUrl,
      authorization_endpoint: `${issuerUrl}/oauth/authorize`,
      token_endpoint: `${issuerUrl}/oauth/token`,
      ...(jwks_uri ? { jwks_uri } : {}),
      scopes_supported: [...SMART_SCOPES_SUPPORTED],
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      capabilities: [
        "launch-ehr",
        "launch-standalone",
        "client-confidential-symmetric",
        "client-public",
      ],
    };
    discoveryCache.set("smart-configuration", body);
    return reply.send(body);
  });

  app.get("/.well-known/openid-configuration", async (_request, reply) => {
    const hit = discoveryCache.get("openid-configuration");
    if (hit !== undefined) return reply.send(hit);

    const issuerUrl = env.oauthIssuer.replace(/\/$/, "");
    const jwksDoc = await exportJwksJson(env);
    const jwks_uri = jwksDoc
      ? `${issuerUrl}/.well-known/jwks.json`
      : undefined;
    const body = {
      issuer: issuerUrl,
      authorization_endpoint: `${issuerUrl}/oauth/authorize`,
      token_endpoint: `${issuerUrl}/oauth/token`,
      ...(jwks_uri ? { jwks_uri } : {}),
      scopes_supported: ["openid", "profile", "fhirUser", ...SMART_SCOPES_SUPPORTED],
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      subject_types_supported: ["public"],
      id_token_signing_alg_values_supported: ["RS256", "HS256"],
    };
    discoveryCache.set("openid-configuration", body);
    return reply.send(body);
  });

  app.get("/.well-known/jwks.json", async (_request, reply) => {
    const hit = discoveryCache.get("jwks.json");
    if (hit !== undefined) return reply.send(hit);

    const jwks = await exportJwksJson(env);
    if (!jwks) {
      return jsonReply(reply, 404, {
        error: "JWKS not available (configure HUB_JWT_PRIVATE_KEY_PEM or HUB_JWT_PUBLIC_KEY_PEM for RS256)",
      });
    }
    discoveryCache.set("jwks.json", jwks);
    return reply.send(jwks);
  });

  app.get("/oauth/authorize", async (request, reply) => {
    if (!hasJwtSigningMaterial(env)) {
      return jsonReply(reply, 503, {
        error: "server_error",
        error_description: "JWT signing not configured (HUB_JWT_SECRET or HUB_JWT_PRIVATE_KEY_PEM)",
      });
    }
    const q = request.query as Record<string, string | undefined>;
    const response_type = q.response_type ?? "";
    const client_id = q.client_id ?? "";
    const redirect_uri = q.redirect_uri ?? "";
    const scope = q.scope ?? "";
    const state = q.state;
    const launch = q.launch;
    const code_challenge = q.code_challenge ?? "";
    const code_challenge_method = q.code_challenge_method ?? "";
    const nonce = q.nonce;

    const redirectErr = (
      error: string,
      description?: string,
      includeState = true,
    ) => {
      try {
        const u = new URL(redirect_uri);
        u.searchParams.set("error", error);
        if (includeState && state !== undefined) u.searchParams.set("state", state);
        if (description)
          u.searchParams.set("error_description", description);
        return reply.redirect(u.toString());
      } catch {
        return jsonReply(reply, 400, {
          error,
          error_description: description ?? "invalid redirect_uri",
        });
      }
    };

    if (response_type !== "code") {
      return jsonReply(reply, 400, {
        error: "unsupported_grant_type",
        error_description: "response_type must be code",
      });
    }
    if (!client_id || !redirect_uri) {
      return jsonReply(reply, 400, {
        error: "invalid_request",
        error_description: "client_id and redirect_uri required",
      });
    }
    if (!code_challenge || code_challenge_method !== "S256") {
      return jsonReply(reply, 400, {
        error: "invalid_request",
        error_description: "PKCE required: code_challenge and code_challenge_method=S256",
      });
    }

    const clientR = await pool.query<{
      tenant_id: string;
      redirect_uris: string[];
    }>(
      `SELECT tenant_id, redirect_uris FROM oauth_client WHERE client_id = $1 LIMIT 1`,
      [client_id],
    );
    const oc = clientR.rows[0];
    if (!oc) {
      return jsonReply(reply, 400, {
        error: "invalid_client",
        error_description: "unknown client_id",
      });
    }
    if (!oc.redirect_uris.includes(redirect_uri)) {
      return jsonReply(reply, 400, {
        error: "invalid_request",
        error_description: "redirect_uri not registered for client",
      });
    }

    let launchRowId: string | null = null;

    if (launch) {
      const lr = await pool.query<{
        id: string;
        tenant_id: string;
      }>(
        `SELECT id, tenant_id FROM smart_launch_context
         WHERE id = $1::uuid AND expires_at > NOW()`,
        [launch],
      );
      const row = lr.rows[0];
      if (!row) return redirectErr("invalid_request", "invalid or expired launch");
      if (row.tenant_id !== oc.tenant_id) {
        return redirectErr("invalid_request", "launch tenant mismatch");
      }
      launchRowId = row.id;
    }

    const code = randomBytes(32).toString("hex");
    const codeHash = sha256Hex(code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      `INSERT INTO oauth_authorization_code
       (code_hash, client_id, tenant_id, launch_id, redirect_uri, scope, expires_at,
        code_challenge, code_challenge_method, nonce)
       VALUES ($1, $2, $3::uuid, $4::uuid, $5, $6, $7, $8, $9, $10)`,
      [
        codeHash,
        client_id,
        oc.tenant_id,
        launchRowId,
        redirect_uri,
        scope,
        expiresAt.toISOString(),
        code_challenge,
        code_challenge_method,
        nonce ?? null,
      ],
    );

    await audit(sink, request, {
      action: "EXECUTE",
      outcome: "success",
      actor: {
        tenantId: "oauth",
        clientId: client_id,
        role: "integration",
      },
      entity: { type: "Security" },
      api: { method: "GET", path: "/oauth/authorize" },
      network: { requestId: request.id },
      detail: `authorize scope=${scope} launch=${launch ?? "none"} pkce=S256`,
    });

    const ok = new URL(redirect_uri);
    ok.searchParams.set("code", code);
    if (state !== undefined) ok.searchParams.set("state", state);
    return reply.redirect(ok.toString());
  });

  app.post("/oauth/token", async (request, reply) => {
    if (!hasJwtSigningMaterial(env)) {
      return jsonReply(reply, 503, {
        error: "server_error",
        error_description: "JWT signing not configured",
      });
    }
    const body = request.body as Record<string, string | undefined>;
    const grant_type = body.grant_type ?? "";

    if (grant_type === "refresh_token") {
      const refresh_token = body.refresh_token ?? "";
      const client_id = body.client_id ?? "";
      const client_secret = body.client_secret;
      if (!refresh_token || !client_id) {
        return jsonReply(reply, 400, {
          error: "invalid_request",
          error_description: "refresh_token and client_id required",
        });
      }

      const auth = await authenticateOAuthClient(pool, client_id, client_secret);
      if (!auth.ok) {
        return jsonReply(reply, 401, { error: "invalid_client" });
      }

      const rtHash = sha256Hex(refresh_token);
      const rtR = await pool.query<{
        tenant_id: string;
        client_id: string;
        scope: string | null;
        launch_id: string | null;
        patient_id: string | null;
        expires_at: Date;
      }>(
        `SELECT tenant_id, client_id, scope, launch_id, patient_id, expires_at
         FROM oauth_refresh_token
         WHERE token_hash = $1 AND revoked_at IS NULL`,
        [rtHash],
      );
      const rtRow = rtR.rows[0];
      if (!rtRow) {
        return jsonReply(reply, 400, {
          error: "invalid_grant",
          error_description: "invalid refresh token",
        });
      }
      if (rtRow.expires_at.getTime() < Date.now()) {
        return jsonReply(reply, 400, {
          error: "invalid_grant",
          error_description: "refresh token expired",
        });
      }
      if (rtRow.client_id !== client_id) {
        return jsonReply(reply, 400, { error: "invalid_grant" });
      }
      if (rtRow.tenant_id !== auth.tenant_id) {
        return jsonReply(reply, 400, { error: "invalid_grant" });
      }

      const tenantR = await pool.query<{ external_key: string }>(
        `SELECT external_key FROM tenant WHERE id = $1::uuid`,
        [rtRow.tenant_id],
      );
      const trow = tenantR.rows[0];
      if (!trow) return jsonReply(reply, 500, { error: "server_error" });

      let patientLogical: string | undefined = rtRow.patient_id ?? undefined;
      if (!patientLogical && rtRow.launch_id) {
        const pr = await pool.query<{ patient_id: string }>(
          `SELECT patient_id FROM smart_launch_context WHERE id = $1::uuid`,
          [rtRow.launch_id],
        );
        patientLogical = pr.rows[0]?.patient_id;
      }

      const scopeStr = rtRow.scope ?? "";

      let access_token: string;
      try {
        access_token = await signHubAccessToken(env, {
          clientId: client_id,
          tenantUuid: rtRow.tenant_id,
          tenantExternalKey: trow.external_key,
          patientLogicalId: patientLogical,
          scope: scopeStr,
        });
      } catch {
        return jsonReply(reply, 500, { error: "server_error" });
      }

      const newRefreshRaw = randomBytes(32).toString("hex");
      const newHash = sha256Hex(newRefreshRaw);
      const newExp = new Date(Date.now() + REFRESH_TTL_MS);

      const clientDb = await pool.connect();
      try {
        await clientDb.query("BEGIN");
        await clientDb.query(
          `UPDATE oauth_refresh_token SET revoked_at = NOW(), rotated_from_hash = $2
           WHERE token_hash = $1`,
          [rtHash, newHash],
        );
        await clientDb.query(
          `INSERT INTO oauth_refresh_token
           (token_hash, client_id, tenant_id, launch_id, patient_id, scope, expires_at)
           VALUES ($1, $2, $3::uuid, $4::uuid, $5, $6, $7)`,
          [
            newHash,
            client_id,
            rtRow.tenant_id,
            rtRow.launch_id,
            patientLogical ?? null,
            scopeStr,
            newExp.toISOString(),
          ],
        );
        await clientDb.query("COMMIT");
      } catch {
        try {
          await clientDb.query("ROLLBACK");
        } catch {
          /* ignore */
        }
        clientDb.release();
        return jsonReply(reply, 500, { error: "server_error" });
      }
      clientDb.release();

      await audit(sink, request, {
        action: "EXECUTE",
        outcome: "success",
        actor: {
          tenantId: trow.external_key,
          clientId: client_id,
          role: "integration",
        },
        entity: { type: "Security" },
        api: { method: "POST", path: "/oauth/token" },
        network: { requestId: request.id },
        detail: "refresh_token grant + rotation",
      });

      const out: Record<string, unknown> = {
        access_token,
        token_type: "Bearer",
        expires_in: 3600,
        refresh_token: newRefreshRaw,
        scope: scopeStr,
      };
      if (patientLogical) out.patient = patientLogical;
      recordOAuthTokenIssued("refresh_token");
      return reply.send(out);
    }

    if (grant_type !== "authorization_code") {
      return jsonReply(reply, 400, {
        error: "unsupported_grant_type",
      });
    }

    const code = body.code ?? "";
    const redirect_uri = body.redirect_uri ?? "";
    const client_id = body.client_id ?? "";
    const client_secret = body.client_secret;
    const code_verifier = body.code_verifier ?? "";

    if (!code || !redirect_uri || !client_id) {
      return jsonReply(reply, 400, {
        error: "invalid_request",
        error_description: "code, redirect_uri, and client_id required",
      });
    }

    const auth = await authenticateOAuthClient(pool, client_id, client_secret);
    if (!auth.ok) {
      return jsonReply(reply, 401, { error: "invalid_client" });
    }

    const codeHash = sha256Hex(code);
    const authR = await pool.query<{
      id: string;
      tenant_id: string;
      redirect_uri: string;
      scope: string | null;
      launch_id: string | null;
      expires_at: Date;
      code_challenge: string | null;
      code_challenge_method: string | null;
      nonce: string | null;
    }>(
      `DELETE FROM oauth_authorization_code
       WHERE code_hash = $1 AND client_id = $2
       RETURNING id, tenant_id, redirect_uri, scope, launch_id, expires_at,
                 code_challenge, code_challenge_method, nonce`,
      [codeHash, client_id],
    );
    const authRow = authR.rows[0];
    if (!authRow) {
      return jsonReply(reply, 400, {
        error: "invalid_grant",
        error_description: "unknown or reused code",
      });
    }
    if (authRow.expires_at.getTime() < Date.now()) {
      return jsonReply(reply, 400, {
        error: "invalid_grant",
        error_description: "expired code",
      });
    }
    if (authRow.redirect_uri !== redirect_uri) {
      return jsonReply(reply, 400, {
        error: "invalid_grant",
        error_description: "redirect_uri mismatch",
      });
    }
    if (authRow.tenant_id !== auth.tenant_id) {
      return jsonReply(reply, 400, {
        error: "invalid_grant",
      });
    }

    if (
      !authRow.code_challenge ||
      authRow.code_challenge_method !== "S256"
    ) {
      return jsonReply(reply, 400, {
        error: "invalid_grant",
        error_description: "authorization code missing PKCE",
      });
    }
    if (!code_verifier || !verifyPkceS256(code_verifier, authRow.code_challenge)) {
      return jsonReply(reply, 400, {
        error: "invalid_grant",
        error_description: "invalid code_verifier",
      });
    }

    const tenantR = await pool.query<{ external_key: string }>(
      `SELECT external_key FROM tenant WHERE id = $1::uuid`,
      [authRow.tenant_id],
    );
    const trow = tenantR.rows[0];
    if (!trow) {
      return jsonReply(reply, 500, { error: "server_error" });
    }

    let patientLogical: string | undefined;
    if (authRow.launch_id) {
      const pr = await pool.query<{ patient_id: string }>(
        `SELECT patient_id FROM smart_launch_context WHERE id = $1::uuid`,
        [authRow.launch_id],
      );
      patientLogical = pr.rows[0]?.patient_id;
    }

    const scopeStr = authRow.scope ?? "";
    const scopesArr = scopeStr.split(/\s+/).filter(Boolean);

    let access_token: string;
    try {
      access_token = await signHubAccessToken(env, {
        clientId: client_id,
        tenantUuid: authRow.tenant_id,
        tenantExternalKey: trow.external_key,
        patientLogicalId: patientLogical,
        scope: scopeStr,
      });
    } catch {
      return jsonReply(reply, 500, { error: "server_error" });
    }

    const issuerUrl = env.oauthIssuer.replace(/\/$/, "");
    let id_token: string | undefined;
    if (scopesArr.includes("openid")) {
      const sub =
        patientLogical != null
          ? `${issuerUrl}/fhir/Patient/${patientLogical}`
          : client_id;
      const fhirUserUrl =
        scopesArr.includes("fhirUser") && patientLogical != null
          ? `${issuerUrl}/fhir/Patient/${patientLogical}`
          : undefined;
      try {
        id_token = await signOpenIdToken(env, {
          clientId: client_id,
          subject: sub,
          nonce: authRow.nonce ?? undefined,
          fhirUserUrl,
        });
      } catch {
        return jsonReply(reply, 500, { error: "server_error" });
      }
    }

    const refreshRaw = randomBytes(32).toString("hex");
    const refreshHash = sha256Hex(refreshRaw);
    const refreshExp = new Date(Date.now() + REFRESH_TTL_MS);
    await pool.query(
      `INSERT INTO oauth_refresh_token
       (token_hash, client_id, tenant_id, launch_id, patient_id, scope, expires_at)
       VALUES ($1, $2, $3::uuid, $4::uuid, $5, $6, $7)`,
      [
        refreshHash,
        client_id,
        authRow.tenant_id,
        authRow.launch_id,
        patientLogical ?? null,
        scopeStr,
        refreshExp.toISOString(),
      ],
    );

    await audit(sink, request, {
      action: "EXECUTE",
      outcome: "success",
      actor: {
        tenantId: trow.external_key,
        clientId: client_id,
        role: "integration",
      },
      entity: { type: "Security" },
      api: { method: "POST", path: "/oauth/token" },
      network: { requestId: request.id },
      detail: "issued access_token + refresh_token",
    });

    const payload: Record<string, unknown> = {
      access_token,
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: refreshRaw,
      scope: scopeStr,
    };
    if (patientLogical) payload.patient = patientLogical;
    if (id_token) payload.id_token = id_token;
    recordOAuthTokenIssued("authorization_code");
    return reply.send(payload);
  });

  await app.register(
    async (secured) => {
      secured.addHook(
        "preHandler",
        async (request: FastifyRequest, reply: FastifyReply) => {
          const resolved = await resolveTenant(
            pool,
            env,
            request.headers.authorization,
            request.headers["x-hub-api-key"]?.toString(),
          );
          if (!resolved) {
            return jsonReply(reply, 401, {
              error: "Missing or invalid API credentials",
            });
          }
          request.tenantUuid = resolved.tenantUuid;
          request.tenantExternalKey = resolved.externalKey;
        },
      );

      secured.post("/smart/launch", async (request, reply) => {
        const tenant = request.tenantUuid!;
        const ext = request.tenantExternalKey!;
        const reqBody = request.body as { patientId?: unknown } | undefined;
        const patientId =
          reqBody && typeof reqBody.patientId === "string"
            ? reqBody.patientId.trim()
            : "";
        if (!patientId) {
          return jsonReply(reply, 400, {
            error: "patientId required",
          });
        }

        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
        const ins = await pool.query<{ id: string }>(
          `INSERT INTO smart_launch_context (tenant_id, patient_id, expires_at)
           VALUES ($1::uuid, $2, $3)
           RETURNING id::text`,
          [tenant, patientId, expiresAt.toISOString()],
        );

        await audit(sink, request, {
          action: "CREATE",
          outcome: "success",
          actor: {
            tenantId: ext,
            clientId: "api-key",
            role: "integration",
          },
          entity: { type: "Patient", id: patientId },
          api: { method: "POST", path: "/internal/v1/smart/launch" },
          network: { requestId: request.id },
          detail: `launch context expires=${expiresAt.toISOString()}`,
        });

        return reply.send({ launch: ins.rows[0]!.id });
      });
    },
    { prefix: "/internal/v1" },
  );
}
