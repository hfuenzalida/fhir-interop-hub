/**
 * Load `.env` from monorepo root first, then `services/hub-api/.env` (override).
 * `npm run dev -w @fhir-hub/hub-api` uses cwd `services/hub-api`, so the default
 * `dotenv/config` only looked there and missed root `.env`.
 */
import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const hubApiRoot = join(here, "..");
const repoRoot = join(here, "..", "..", "..");

config({ path: join(repoRoot, ".env") });
config({ path: join(hubApiRoot, ".env"), override: true });
