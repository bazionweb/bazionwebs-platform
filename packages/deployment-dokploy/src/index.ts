import type {
  TenantHostingDeployment,
  TenantHostingDeploymentReference,
  TenantHostingProvider,
  TenantHostingSecretResolver,
  TenantId,
  TenantHostingTemplate,
} from "@bazion/platform-contracts";

export interface DokployConfig {
  baseUrl: string;
  apiKey: string;
  environmentId: string;
  serverId?: string;
  fetch?: typeof fetch;
  /** Total attempts for read-only GET requests. Mutating POST requests are never retried. */
  readRetryAttempts?: number;
  /** Initial delay before retrying a transient read failure. */
  readRetryBaseDelayMs?: number;
  /** Maximum delay, including a provider-supplied Retry-After value. */
  readRetryMaxDelayMs?: number;
}

interface DokployResource {
  composeId?: string;
  id?: string;
  compose?: { composeId?: string; id?: string };
  composeStatus?: string;
  status?: string;
  updatedAt?: string;
  createdAt?: string;
  name?: string;
  appName?: string;
  environmentId?: string;
  serverId?: string;
}

function resourceId(payload: unknown): string {
  if (!payload || typeof payload !== "object") throw new Error("DOKPLOY_INVALID_RESPONSE");
  const value = payload as DokployResource;
  const id = value.composeId ?? value.id ?? value.compose?.composeId ?? value.compose?.id;
  if (typeof id !== "string" || !id.trim()) throw new Error("DOKPLOY_RESOURCE_ID_MISSING");
  return id;
}

const retryableReadStatuses = new Set([408, 425, 429, 502, 503, 504]);

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function retryAfterDelay(value: string | null, maximumMs: number): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(maximumMs, seconds * 1_000);
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return null;
  return Math.min(maximumMs, Math.max(0, timestamp - Date.now()));
}

function safeEnvironment(values: Readonly<Record<string, string>>): string {
  return Object.entries(values).map(([key, value]) => {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || /[\r\n\0]/.test(value)) {
      throw new Error("DOKPLOY_INVALID_ENVIRONMENT");
    }
    return `${key}=${value}`;
  }).join("\n");
}

function deploymentState(value: string | undefined): TenantHostingDeployment["state"] {
  switch (value?.toLowerCase()) {
    case "running":
    case "done": return "running";
    case "stopped":
    case "idle": return "stopped";
    case "error":
    case "failed": return "failed";
    case "provisioning": return "provisioning";
    case "deploying":
    case "building": return "deploying";
    case "ready": return "ready";
    default: return "unknown";
  }
}

/** Thin, secret-safe Dokploy Compose API client. It never logs request or response bodies. */
export class DokployComposeProvider implements TenantHostingProvider {
  private readonly baseUrl: URL;
  private readonly requestFetch: typeof fetch;
  private readonly readRetryAttempts: number;
  private readonly readRetryBaseDelayMs: number;
  private readonly readRetryMaxDelayMs: number;

  constructor(
    private readonly config: DokployConfig,
    private readonly secrets: TenantHostingSecretResolver,
  ) {
    this.baseUrl = new URL(config.baseUrl);
    this.readRetryAttempts = config.readRetryAttempts ?? 3;
    this.readRetryBaseDelayMs = config.readRetryBaseDelayMs ?? 200;
    this.readRetryMaxDelayMs = config.readRetryMaxDelayMs ?? 2_000;
    if (
      !Number.isInteger(this.readRetryAttempts) || this.readRetryAttempts < 1 || this.readRetryAttempts > 5 ||
      !Number.isInteger(this.readRetryBaseDelayMs) || this.readRetryBaseDelayMs < 0 || this.readRetryBaseDelayMs > 5_000 ||
      !Number.isInteger(this.readRetryMaxDelayMs) || this.readRetryMaxDelayMs < this.readRetryBaseDelayMs || this.readRetryMaxDelayMs > 30_000
    ) throw new Error("DOKPLOY_RETRY_CONFIGURATION_INVALID");
    if (
      this.baseUrl.protocol !== "https:" ||
      this.baseUrl.username ||
      this.baseUrl.password ||
      this.baseUrl.search ||
      this.baseUrl.hash ||
      !config.apiKey.trim() ||
      !config.environmentId.trim()
    ) throw new Error("DOKPLOY_CONFIGURATION_INVALID");
    this.baseUrl.pathname = `${this.baseUrl.pathname.replace(/\/$/, "")}/api/`;
    this.requestFetch = config.fetch ?? fetch;
  }

  private async request(path: string, method: "GET" | "POST", body?: unknown): Promise<unknown> {
    const url = new URL(path, this.baseUrl);
    // Replaying a mutating request can create duplicate resources or deployments
    // when a provider timeout hides a successful operation. Retry GET only.
    const maxAttempts = method === "GET" ? this.readRetryAttempts : 1;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      let response: Response;
      try {
        response = await this.requestFetch(url, {
          method,
          headers: {
            accept: "application/json",
            "content-type": "application/json",
            "x-api-key": this.config.apiKey,
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          signal: AbortSignal.timeout(20_000),
        });
      } catch {
        if (method !== "GET" || attempt >= maxAttempts) {
          throw new Error("DOKPLOY_REQUEST_FAILED");
        }
        await wait(Math.min(
          this.readRetryMaxDelayMs,
          this.readRetryBaseDelayMs * (2 ** (attempt - 1)),
        ));
        continue;
      }

      if (!response.ok) {
        if (method === "GET" && retryableReadStatuses.has(response.status) && attempt < maxAttempts) {
          const delay = retryAfterDelay(response.headers.get("retry-after"), this.readRetryMaxDelayMs)
            ?? Math.min(this.readRetryMaxDelayMs, this.readRetryBaseDelayMs * (2 ** (attempt - 1)));
          await wait(delay);
          continue;
        }
        throw new Error(`DOKPLOY_HTTP_${response.status}`);
      }
      if (response.status === 204) return null;
      const text = await response.text();
      if (!text) return null;
      try { return JSON.parse(text) as unknown; }
      catch { throw new Error("DOKPLOY_INVALID_RESPONSE"); }
    }
    throw new Error("DOKPLOY_REQUEST_FAILED");
  }

  async provision(input: {
    tenantId: TenantId;
    tenantSlug: string;
    template: TenantHostingTemplate;
    composeFile: string;
    environmentSecretRef: string;
  }): Promise<TenantHostingDeploymentReference> {
    if (!/^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/.test(input.tenantSlug)) {
      throw new Error("INVALID_TENANT_SLUG");
    }
    if (!input.composeFile.trim() || !input.environmentSecretRef.trim()) {
      throw new Error("DEPLOYMENT_INPUT_INVALID");
    }

    const name = `${input.tenantSlug}-${input.template}`;
    const appName = `bz-${input.tenantSlug}-${input.template}`.slice(0, 63);
    const created = await this.request("compose.create", "POST", {
      name,
      appName,
      description: `Bazion managed deployment for tenant ${input.tenantSlug}`,
      environmentId: this.config.environmentId,
      ...(this.config.serverId ? { serverId: this.config.serverId } : {}),
      composeType: "docker-compose",
      sourceType: "raw",
      composeFile: input.composeFile,
    });
    const composeId = resourceId(created);

    try {
      const environment = await this.secrets.resolveEnvironment(input.environmentSecretRef);
      await this.request("compose.saveEnvironment", "POST", {
        composeId,
        env: safeEnvironment(environment),
        createEnvFile: true,
      });
    } catch {
      // Keep the resource cleanup non-destructive: persistent volumes are never deleted here.
      await this.request("compose.delete", "POST", { composeId, deleteVolumes: false }).catch(() => undefined);
      throw new Error("DOKPLOY_ENVIRONMENT_SETUP_FAILED");
    }

    return {
      provider: "dokploy",
      resourceId: composeId,
      tenantId: input.tenantId,
      createdAt: new Date().toISOString(),
    };
  }

  async deploy(reference: TenantHostingDeploymentReference): Promise<void> {
    this.assertReference(reference);
    await this.request("compose.deploy", "POST", { composeId: reference.resourceId, freshVolumes: false });
  }

  async start(reference: TenantHostingDeploymentReference): Promise<void> {
    this.assertReference(reference);
    await this.request("compose.start", "POST", { composeId: reference.resourceId });
  }

  async redeploy(reference: TenantHostingDeploymentReference): Promise<void> {
    this.assertReference(reference);
    // Explicitly preserve existing persistent volumes during operator-triggered redeploys.
    await this.request("compose.redeploy", "POST", { composeId: reference.resourceId, freshVolumes: false });
  }

  async inspect(
    reference: TenantHostingDeploymentReference,
    expected?: { expectedTenantSlug?: string; expectedTemplate?: TenantHostingTemplate },
  ): Promise<TenantHostingDeployment> {
    this.assertReference(reference);
    let payload: DokployResource | null;
    try {
      payload = await this.request(`compose.one?composeId=${encodeURIComponent(reference.resourceId)}`, "GET") as DokployResource | null;
    } catch (error) {
      // A missing provider resource is a terminal operational state, not a transient
      // inspection outage. The reconciler will clear its stale provider reference.
      if (error instanceof Error && error.message === "DOKPLOY_HTTP_404") {
        return { reference, state: "removed", lastDeployedAt: null };
      }
      throw error;
    }
    if (!payload) throw new Error("DOKPLOY_RESOURCE_NOT_FOUND");
    if (resourceId(payload) !== reference.resourceId) throw new Error("DOKPLOY_RESOURCE_ID_MISMATCH");
    if (typeof payload.environmentId === "string" && payload.environmentId !== this.config.environmentId) {
      throw new Error("DOKPLOY_RESOURCE_ENVIRONMENT_MISMATCH");
    }
    if (this.config.serverId && typeof payload.serverId === "string" && payload.serverId !== this.config.serverId) {
      throw new Error("DOKPLOY_RESOURCE_SERVER_MISMATCH");
    }
    if (
      expected?.expectedTenantSlug
      && expected?.expectedTemplate
      && typeof payload.name === "string"
      && payload.name !== `${expected.expectedTenantSlug}-${expected.expectedTemplate}`
    ) {
      throw new Error("DOKPLOY_RESOURCE_NAME_MISMATCH");
    }
    return {
      reference,
      state: deploymentState(payload.composeStatus ?? payload.status),
      lastDeployedAt: payload.updatedAt ?? null,
      ...(typeof payload.name === "string" && payload.name.trim()
        ? { providerResourceName: payload.name }
        : {}),
      ...(typeof payload.environmentId === "string" && payload.environmentId.trim()
        ? { providerEnvironmentId: payload.environmentId }
        : {}),
    };
  }

  /** Re-applies resolved runtime secrets to an existing compose resource during credential rotation. */
  async rotateEnvironment(reference: TenantHostingDeploymentReference, environmentSecretRef: string): Promise<void> {
    this.assertReference(reference);
    if (!environmentSecretRef.trim()) {
      throw new Error("DEPLOYMENT_INPUT_INVALID");
    }
    const environment = await this.secrets.resolveEnvironment(environmentSecretRef);
    await this.request("compose.saveEnvironment", "POST", {
      composeId: reference.resourceId,
      env: safeEnvironment(environment),
      createEnvFile: true,
    });
  }

  async stop(reference: TenantHostingDeploymentReference): Promise<void> {
    this.assertReference(reference);
    await this.request("compose.stop", "POST", { composeId: reference.resourceId });
  }

  async remove(reference: TenantHostingDeploymentReference): Promise<void> {
    this.assertReference(reference);
    await this.request("compose.delete", "POST", { composeId: reference.resourceId, deleteVolumes: false });
  }

  private assertReference(reference: TenantHostingDeploymentReference): void {
    if (reference.provider !== "dokploy" || !reference.resourceId || !reference.tenantId) {
      throw new Error("DEPLOYMENT_REFERENCE_INVALID");
    }
  }
}
