/**
 * Thin fetch-based client for hub-api: FHIR JSON + tenant API key auth.
 * OAuth flows use form-encoded POST to `/oauth/token` (SMART / backend clients).
 */

export type HubClientOptions = {
  baseUrl: string;
  /** Primary tenant API key (Bearer). */
  apiKey: string;
  fetchImpl?: typeof fetch;
};

export type FhirResource = Record<string, unknown>;

/** Response from `GET /internal/v1/usage/summary`. */
export type UsageSummaryAuditActionCount = {
  action: string;
  count: number;
};

export type UsageSummaryMetering = {
  prometheusHistograms: string[];
  scrapePath: string;
  note: string;
};

export type UsageSummary = {
  tenantExternalKey: string;
  periodHours: number;
  auditEventsInPeriod: number;
  auditEventsByAction: UsageSummaryAuditActionCount[];
  metering: UsageSummaryMetering;
};

export class HubError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly bodyText: string,
  ) {
    super(message);
    this.name = "HubError";
  }
}

export class HubClient {
  private readonly base: string;
  private readonly fetchFn: typeof fetch;

  constructor(private readonly opts: HubClientOptions) {
    this.base = opts.baseUrl.replace(/\/+$/, "");
    this.fetchFn = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
  }

  private authHeaders(
    json: boolean,
  ): Record<string, string> {
    const h: Record<string, string> = {
      Authorization: `Bearer ${this.opts.apiKey}`,
    };
    if (json) {
      h.Accept = "application/fhir+json";
      h["Content-Type"] = "application/fhir+json";
    }
    return h;
  }

  async getHealth(): Promise<unknown> {
    const r = await this.fetchFn(`${this.base}/health`);
    return (await r.json()) as unknown;
  }

  async getReady(): Promise<unknown> {
    const r = await this.fetchFn(`${this.base}/ready`);
    return (await r.json()) as unknown;
  }

  /** `GET /fhir/metadata` — no auth required on default deployment. */
  async getCapabilityStatement(): Promise<unknown> {
    const r = await this.fetchFn(`${this.base}/fhir/metadata`, {
      headers: { Accept: "application/fhir+json" },
    });
    return this.expectJson(r);
  }

  async readResource(
    resourceType: string,
    id: string,
  ): Promise<FhirResource> {
    const r = await this.fetchFn(
      `${this.base}/fhir/${encodeURIComponent(resourceType)}/${encodeURIComponent(id)}`,
      { headers: this.authHeaders(true) },
    );
    return this.expectJson(r) as Promise<FhirResource>;
  }

  async createResource(
    resourceType: string,
    body: FhirResource,
  ): Promise<FhirResource> {
    const r = await this.fetchFn(
      `${this.base}/fhir/${encodeURIComponent(resourceType)}`,
      {
        method: "POST",
        headers: this.authHeaders(true),
        body: JSON.stringify(body),
      },
    );
    return this.expectJson(r) as Promise<FhirResource>;
  }

  async updateResource(
    resourceType: string,
    id: string,
    body: FhirResource,
  ): Promise<FhirResource> {
    const r = await this.fetchFn(
      `${this.base}/fhir/${encodeURIComponent(resourceType)}/${encodeURIComponent(id)}`,
      {
        method: "PUT",
        headers: this.authHeaders(true),
        body: JSON.stringify(body),
      },
    );
    return this.expectJson(r) as Promise<FhirResource>;
  }

  async deleteResource(resourceType: string, id: string): Promise<void> {
    const r = await this.fetchFn(
      `${this.base}/fhir/${encodeURIComponent(resourceType)}/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers: this.authHeaders(true),
      },
    );
    if (!r.ok && r.status !== 204) {
      const t = await r.text();
      throw new HubError(`DELETE failed: ${r.status}`, r.status, t);
    }
  }

  /** Search: pass query without leading `?` (e.g. `Patient?name=eve`). */
  async search(searchPathWithQuery: string): Promise<unknown> {
    const path = searchPathWithQuery.replace(/^\//, "");
    const r = await this.fetchFn(`${this.base}/fhir/${path}`, {
      headers: {
        Authorization: `Bearer ${this.opts.apiKey}`,
        Accept: "application/fhir+json",
      },
    });
    return this.expectJson(r);
  }

  async getWellKnownSmart(): Promise<unknown> {
    const r = await this.fetchFn(
      `${this.base}/.well-known/smart-configuration`,
    );
    return this.expectJson(r);
  }

  /**
   * OAuth2 token endpoint (`application/x-www-form-urlencoded`).
   * Typical grants: `client_credentials`, `authorization_code`, `refresh_token`.
   */
  async oauthToken(
    params: Record<string, string>,
    basicAuth?: { username: string; password: string },
  ): Promise<unknown> {
    const body = new URLSearchParams(params);
    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
    };
    if (basicAuth) {
      const b64 = Buffer.from(
        `${basicAuth.username}:${basicAuth.password}`,
        "utf8",
      ).toString("base64");
      headers.Authorization = `Basic ${b64}`;
    }
    const r = await this.fetchFn(`${this.base}/oauth/token`, {
      method: "POST",
      headers,
      body: body.toString(),
    });
    return this.expectJson(r);
  }

  /**
   * Tenant usage rollup (`GET /internal/v1/usage/summary`).
   * Omit `hours` to use the server default (24). Server clamps to 1–168.
   */
  async getUsageSummary(hours?: number): Promise<UsageSummary> {
    let url = `${this.base}/internal/v1/usage/summary`;
    if (hours !== undefined) {
      url += `?hours=${encodeURIComponent(String(Math.trunc(hours)))}`;
    }
    const r = await this.fetchFn(url, {
      headers: {
        Authorization: `Bearer ${this.opts.apiKey}`,
        Accept: "application/json",
      },
    });
    return this.expectJson(r) as Promise<UsageSummary>;
  }

  /** Partner JSON APIs under `/internal/v1/*` (same API key). */
  async internalJson(
    path: string,
    options?: {
      method?: string;
      jsonBody?: unknown;
    },
  ): Promise<unknown> {
    const p = path.startsWith("/") ? path : `/${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.opts.apiKey}`,
      Accept: "application/json",
    };
    let body: string | undefined;
    if (options?.jsonBody !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(options.jsonBody);
    }
    const r = await this.fetchFn(`${this.base}${p}`, {
      method: options?.method ?? "GET",
      headers,
      body,
    });
    if (r.status === 204) return null;
    return this.expectJson(r);
  }

  private async expectJson(r: Response): Promise<unknown> {
    const text = await r.text();
    if (!r.ok) {
      throw new HubError(`HTTP ${r.status}`, r.status, text);
    }
    if (!text) return null;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new HubError("Invalid JSON response", r.status, text);
    }
  }
}
