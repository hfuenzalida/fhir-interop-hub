# HIPAA Security Rule — technical safeguards mapping (implementation-aligned)

This document maps common **45 CFR Part 164 Subpart C** technical safeguard expectations to concrete capabilities in this repository. It is **not** legal advice and does not by itself demonstrate HIPAA compliance; your organization must complete policies, BAAs, workforce training, and hosting-specific controls.

## § 164.312(a)(1) Access control

| Expectation | In-repo / operational |
|-------------|------------------------|
| Unique user identification | SMART OAuth clients + issued access tokens; API keys as tenant-scoped integration identities. |
| Emergency access procedure | Optional **break-glass** header captured on audit actor (`BREAK_GLASS_HEADER` / `X-Break-Glass-Reason`). Operational workflow is yours to define. |
| Encryption and decryption | **TLS in transit** is a deployment concern (load balancer / ingress). At-rest encryption is a database / storage platform setting. |
| Automatic logoff | Browser/session behavior for SMART apps; hub uses **stateless JWT** validation with configurable TTL at token issuance. |

## § 164.312(a)(2)(i) Audit controls

| Expectation | In-repo / operational |
|-------------|------------------------|
| Record and examine activity | **Audit events** to stdout and optional PostgreSQL (`audit_event`); includes action, outcome, actor, entity, API, network context. |
| Tamper-evident trail | Per-tenant **hash chain** (`entry_hash`, `row_hash`, `chain_prev_id`) and **`audit_chain_head`**; optional **HMAC** with `AUDIT_CHAIN_SECRET`. |
| Immutability | Database trigger **blocks UPDATE/DELETE** on `audit_event` (append-only / WORM-style at the DB layer). |

## § 164.312(a)(2)(ii) Integrity

| Expectation | In-repo / operational |
|-------------|------------------------|
| Mechanism to corroborate ePHI has not been altered | FHIR resource **`versionId` / `meta.lastUpdated`**; **ETag** + **If-Match** on REST updates; chain hashes on audit rows. |

## § 164.312(e)(1) Transmission security

| Expectation | In-repo / operational |
|-------------|------------------------|
| Integrity controls | HTTPS termination at the edge; JSON/FHIR payload validation (depth, size). |
| Encryption | TLS — configure at reverse proxy / API gateway. |

## § 164.312(c)(1) — Person or entity authentication

| Expectation | In-repo / operational |
|-------------|------------------------|
| Verify identity | **API key** (hashed at rest) and **SMART OAuth 2** with PKCE, JWT verification (`iss`, `aud`, scopes). |

## Related: consent & purpose of use

FHIR **Consent** resources (optional) plus **`CONSENT_POLICY_ENABLED`** align declared **provision.purpose** with **`X-Purpose-Of-Use`** (or configured header) for patient-scoped access. See `docs/COMPLIANCE_CONSENT_AND_AUDIT.md`.

---

## Phase V — deployment attestation (fill per production environment)

Complete this table when locking **HIPAA-aligned** production topology — supports **`docs/templates/CUSTOMER_SECURITY_PACKET.md`** and **`COMPLIANCE_V1_SIGNOFF.md`**.

| Safeguard section above | Implemented in our deployment? | Evidence / owner |
|-------------------------|-------------------------------|------------------|
| §312(a)(1) Access control | | |
| §312(a)(2)(i) Audit controls | | |
| §312(a)(2)(ii) Integrity | | |
| §312(e)(1) Transmission security | | |
| §312(c)(1) Authentication | | |

**Related:** **`docs/PROD_PHASE5_COMPLIANCE_TRUST.md`**, **`docs/templates/DPA_SUBPROCESSORS_CHECKLIST.md`**.
