import type pg from "pg";
import type { HubAuth } from "../auth/hub-auth.js";
import type { AuditSink } from "../audit/sink.js";

declare module "fastify" {
  interface FastifyInstance {
    /** Present when `DATABASE_URL` is configured (writes + auth). */
    pg?: pg.Pool;
    /** Optional read replica pool for FHIR reads only; omit when `DATABASE_READ_URL` unset. */
    pgRead?: pg.Pool;
    auditSink?: AuditSink;
  }

  interface FastifyRequest {
    tenantUuid?: string;
    tenantExternalKey?: string;
    hubAuth?: HubAuth;
    /** Set from optional compliance headers (GAP 4). */
    complianceMeta?: {
      breakGlassReason?: string;
      purposeOfUse?: string;
    };
  }
}
