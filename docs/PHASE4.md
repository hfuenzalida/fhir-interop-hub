# Phase 4 — Patient `$everything` + expanded SMART compartment

Phase 4 adds:

1. **`GET /fhir/Patient/{id}/$everything`** — returns a **`Bundle`** (`type: searchset`) containing the **Patient** plus related **Observation**, **Condition**, **Encounter**, and **DocumentReference** resources whose **`subject.reference`** targets `Patient/{id}` (same tenant).

2. **SMART JWT read path** for **Condition**, **Encounter**, and **DocumentReference** — same rules as Observation: **`patient/<Type>.rs`** / **`.read`** (or compatible) scopes, **`subject`** must reference the token’s **`patient`**.

No new SQL migration is required (uses existing `fhir_resource` JSON and `subject.reference` queries).

## Query parameters (`$everything`)

| Param    | Meaning |
|----------|---------|
| `_count` | Max rows **per companion resource type** (default **100**, max **200**). Patient is always included once if found. |

## Authorization

| Auth        | Behavior |
|-------------|----------|
| **API key** | Full bundle for the tenant’s patient + compartment resources. |
| **SMART JWT** | **`patient`** must equal `{id}`; requires **`patient/Patient.\*`** read scope to include Patient; each companion type is included only if scope allows that type (e.g. **`patient/Observation.rs`**). |

## Example (CMD)

Replace `KEY` / `TOKEN` / patient id as appropriate.

```bat
curl.exe -s "http://127.0.0.1:3000/fhir/Patient/HL7PAT001/$everything?_count=50" ^
  -H "X-Hub-Api-Key: %KEY%"
```

```bat
curl.exe -s "http://127.0.0.1:3000/fhir/Patient/HL7PAT001/$everything" ^
  -H "Authorization: Bearer %TOKEN%"
```

## Limits

- Compartment membership is determined only via **`subject.reference`** → **`Patient/{id}`** (FHIR-normal pattern for these types in this hub).
- **`CapabilityStatement`** lists **`Patient`-`everything`** under the Patient resource **`operation`** array.
