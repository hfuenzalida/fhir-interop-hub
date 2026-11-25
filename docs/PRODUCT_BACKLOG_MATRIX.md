# Product backlog matrix — lanes ↔ ROADMAP.md

Use this with **`docs/PROD_PHASE6_PRODUCT_BACKLOG.md`** and **`docs/PROD_PHASE0_CHARTER.md`** to **prioritize by revenue lane**, then jump to the right **`ROADMAP.md`** section.

**Lanes** match **`ROADMAP_TO_PROD.md`** Phase VI wording.

| Lane | Typical buyer pull | **`ROADMAP.md`** anchors |
|------|-------------------|-------------------------|
| **Analytics / migration** | Data warehouse, ACO analytics, EHR replacement | **§1** — **Bulk Data `$export`**; **§5** — background jobs, load testing; **§7** — migration tooling, NDJSON (partially shipped). |
| **Event-driven** | Near-real-time apps, lower polling costs | **§1** — **Subscriptions**; **§5** — job queues, DLQ. |
| **Documents** | Clinical documents, imaging pointers | **§1** — **Binary** + **DocumentReference** lifecycle. |
| **Interop depth** | Deeper EHR replacement, app parity | **§1** — US Core full IG, search params, **`_revinclude`**, **PATCH**, **history**; **§1** — additional **HL7 v2**, CDA, **terminology**. |
| **Identity** | Enterprise IAM, many OAuth clients at scale | **§2** — client registry **UI/API**, **admin consent UI**, ES256, full SMART scope matrix. |
| **MPI** | Patient identity integrity | **§7** — probabilistic tuning, **unmerge**, operational merge policies — **`docs/GAP7_DATA_MODEL.md`**. |

**Already in baseline (do not re-scope as “Phase VI” unless extending):** see **`ROADMAP.md`** “Foundation shipped” lines per GAP (e.g. GAP 1 slice, GAP 2 slice, GAP 7 MPI routes).

When two lanes conflict on engineering capacity, use **charter ICP** as tie-breaker.
