export type TenantId = string & { readonly __brand: "TenantId" };
export type UserId = string & { readonly __brand: "UserId" };

export type PlatformRole = "platform_owner" | "platform_admin" | "support";
export type TenantRole = "tenant_owner" | "tenant_admin" | "staff" | "customer";

/** Shared RLS is the default; dedicated databases are activated only after provisioning and schema verification. */
export type TenantDatabaseIsolationTier = "shared" | "dedicated";

/** Release rings let tenant groups adopt the same immutable artifact at different times. */
export type TenantReleaseRing = "staging" | "canary" | "stable" | "pinned";

export type ImmutableImageDigest = `sha256:${string}`;

export interface TenantDatabaseBinding {
  tenantId: TenantId;
  tier: TenantDatabaseIsolationTier;
  state: "shared" | "provisioning" | "ready" | "failed" | "draining";
  /** Secret-manager identifier only. Never store a DSN, password or token in the tenant registry. */
  runtimeSecretRef: string | null;
  /** Migration credential is separate from the application runtime credential. */
  migrationSecretRef: string | null;
  schemaVersion: string | null;
}

/** Control-plane lookup, implemented using an explicitly read-only directory credential. */
export interface TenantDatabaseBindingResolver {
  resolve(tenantId: TenantId): Promise<TenantDatabaseBinding | null>;
}

/** Adapter for a managed secret store. Database credentials are never persisted in tenant metadata. */
export interface TenantDatabaseSecretResolver {
  resolveDatabaseUrl(secretReference: string): Promise<string>;
}

export interface TenantReleaseArtifact {
  sourceRevision: string;
  apiImageDigest: ImmutableImageDigest;
  storefrontImageDigest: ImmutableImageDigest;
  schemaVersion: string;
}

export interface TenantReleaseAssignment {
  tenantId: TenantId;
  ring: TenantReleaseRing;
  active: TenantReleaseArtifact | null;
  candidate: TenantReleaseArtifact | null;
  state: "stable" | "staging" | "canary" | "promoting" | "failed" | "rolling_back";
  updatedAt: string;
}

export function parseImmutableImageDigest(value: string): ImmutableImageDigest {
  if (!/^sha256:[a-f0-9]{64}$/.test(value)) throw new Error("INVALID_IMAGE_DIGEST");
  return value as ImmutableImageDigest;
}

export interface TenantDatabaseProvisioner {
  provision(input: { tenantId: TenantId }): Promise<TenantDatabaseBinding>;
  applyMigrations(input: { tenantId: TenantId; targetSchemaVersion: string }): Promise<void>;
  verify(input: { tenantId: TenantId; expectedSchemaVersion: string }): Promise<void>;
  backup(input: { tenantId: TenantId }): Promise<{ backupReference: string }>;
  restore(input: { tenantId: TenantId; backupReference: string }): Promise<void>;
}

export interface TenantDeploymentProvider {
  stage(input: { tenantId: TenantId; artifact: TenantReleaseArtifact; ring: TenantReleaseRing }): Promise<{ deploymentReference: string }>;
  shiftTraffic(input: { deploymentReference: string; percentage: number }): Promise<void>;
  promote(input: { tenantId: TenantId; deploymentReference: string }): Promise<void>;
  rollback(input: { tenantId: TenantId; deploymentReference: string }): Promise<void>;
}

export interface TenantContext {
  tenantId: TenantId;
  tenantSlug: string;
  currency: string;
  locale: string;
  timeZone: string;
}

export interface Principal {
  userId: UserId;
  tenantId: TenantId;
  roles: readonly (PlatformRole | TenantRole)[];
  authenticationMethod: "session" | "service_token";
}

export function assertTenantMatch(expectedTenantId: string, actualTenantId: string): void {
  if (expectedTenantId !== actualTenantId) {
    throw new Error("TENANT_CONTEXT_MISMATCH");
  }
}

export const DISTRIBUTION_MODES = ["shared-managed", "dedicated"] as const;
export type DistributionMode = (typeof DISTRIBUTION_MODES)[number];

export const TENANT_HOSTING_TEMPLATES = ["wordpress", "node-nextjs", "ecommerce"] as const;
export type TenantHostingTemplate = (typeof TENANT_HOSTING_TEMPLATES)[number];

export const TENANT_HOSTING_DEPLOYMENT_STATES = [
  "provisioning",
  "ready",
  "deploying",
  "running",
  "stopped",
  "failed",
  "unknown",
  "removed",
] as const;
export type TenantHostingDeploymentState = (typeof TENANT_HOSTING_DEPLOYMENT_STATES)[number];

export interface TenantHostingDeploymentReference {
  provider: string;
  resourceId: string;
  tenantId: TenantId;
  createdAt: string;
}

export interface TenantHostingDeployment {
  reference: TenantHostingDeploymentReference;
  state: TenantHostingDeploymentState;
  lastDeployedAt: string | null;
  /** Provider-reported identity metadata used to verify recovery ownership. */
  providerResourceName?: string;
  /** Provider-reported environment/project scope; never supplied by the caller. */
  providerEnvironmentId?: string;
}

/**
 * Provider-neutral hosting port. Secret values are resolved at deployment time and
 * must never be copied into tenant metadata or returned from this interface.
 */
export interface TenantHostingProvider {
  provision(input: {
    tenantId: TenantId;
    tenantSlug: string;
    template: TenantHostingTemplate;
    composeFile: string;
    environmentSecretRef: string;
  }): Promise<TenantHostingDeploymentReference>;
  deploy(reference: TenantHostingDeploymentReference): Promise<void>;
  start(reference: TenantHostingDeploymentReference): Promise<void>;
  stop(reference: TenantHostingDeploymentReference): Promise<void>;
  redeploy(reference: TenantHostingDeploymentReference): Promise<void>;
  inspect(reference: TenantHostingDeploymentReference): Promise<TenantHostingDeployment>;
  /** Removes the provider resource but preserves persistent volumes by default. */
  remove(reference: TenantHostingDeploymentReference): Promise<void>;
}

/** Resolves environment variables from a managed secret store just in time. */
export interface TenantHostingSecretResolver {
  resolveEnvironment(reference: string): Promise<Readonly<Record<string, string>>>;
}
