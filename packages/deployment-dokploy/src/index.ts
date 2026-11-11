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
}

function resourceId(payload: unknown): string {
  if (!payload || typeof payload !== "object") throw new Error("DOKPLOY_INVALID_RESPONSE");
  const value = payload as DokployResource;
  const id = value.composeId ?? value.id ?? value.compose?.composeId ?? value.compose?.id;
  if (typeof id !== "string" || !id.trim()) throw new Error("DOKPLOY_RESOURCE_ID_MISSING");
  return id;
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

  constructor(
    private readonly config: DokployConfig,
    private readonly secrets: TenantHostingSecretResolver,
  ) {
    this.baseUrl = new URL(config.baseUrl);
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
    const response = await this.requestFetch(url, {
      method,
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-api-key": this.config.apiKey,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`DOKPLOY_HTTP_${response.status}`);
    if (response.status === 204) return null;
    const text = await response.text();
    if (!text) return null;
    try { return JSON.parse(text) as unknown; }
    catch { throw new Error("DOKPLOY_INVALID_RESPONSE"); }
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

  async inspect(reference: TenantHostingDeploymentReference): Promise<TenantHostingDeployment> {
    this.assertReference(reference);
    const payload = await this.request(`compose.one?composeId=${encodeURIComponent(reference.resourceId)}`, "GET") as DokployResource | null;
    if (!payload) throw new Error("DOKPLOY_RESOURCE_NOT_FOUND");
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
