# Penetration test scope (template)

Use with your security vendor or internal red team. Replace bracketed fields; attach API base URLs and **non-production** credentials that mirror prod configuration.

## 1. Targets

| Environment | Base URL | Notes |
|---------------|----------|--------|
| **Staging** | `https://` *[host]* | Preferred — **no real PHI**; synthetic patients only. |
| **Prod** | `[ ]` allowed only under contract / change window | Requires legal & customer approval. |

## 2. In-scope surfaces

| Surface | Paths / behaviors |
|---------|-------------------|
| **FHIR** | `/fhir/*` — CRUD, search, Bundle transaction/batch (as enabled). |
| **OAuth / SMART** | `/.well-known/*`, `/oauth/authorize`, `/oauth/token`, JWKS. |
| **System** | `/health`, `/ready` — informational only; still report cache poisoning / SSRF if found. |
| **Internal** | `/internal/v1/*`, `/internal/metrics` — **API key** or **metrics token** as documented. |
| **Ingestion** | HL7 / FHIR ingest routes enabled in staging — *[list]* |

## 3. Out of scope (typical)

- Third-party EHRs, IdPs, or customer networks.  
- Social engineering, physical access, employee laptops.  
- **Denial-of-service** beyond rate-limit verification (coordinate separately).  
- Cloud control plane (unless explicitly added).

## 4. Rules of engagement

- **No** production patient data in reports; use **request IDs** and **redacted** payloads.  
- Stop on **critical** discovery if exploitation risks live PHI — coordinate with ops.  
- **Credential** rotation after testing completes.

## 5. Success criteria

- Report with **rated** findings (e.g. CVSS), reproduction steps, and **remediation** suggestions.  
- Critical / High findings tracked to closure or signed risk acceptance.

## 6. References

- **`docs/GAP3_SECURITY.md`** — in-app controls.  
- **`docs/THREAT_MODEL_V0.md`** — assets and boundaries.
