import { resolve } from "node:path";
import { DokployComposeProvider, type DokployConfig } from "@bazion/deployment-dokploy";
import { pool } from "../../lib/database.js";
import {
  PostgresHostingProvisioningStore,
  TenantHostingProvisioningService,
  type ProvisionTenantHostingInput,
  type ProvisionTenantHostingResult,
} from "./provisioning.js";
import { DockerSecretTenantHostingSecretResolver } from "./secrets.js";
import { loadTenantHostingTemplate } from "./templates.js";
import type { TenantHostingTemplate } from "@bazion/platform-contracts";

export interface HostingRuntimeConfig {
  provider: "disabled" | "dokploy";
  secretDirectory: string;
  templateDirectory: string;
  dokploy: DokployConfig | null;
}

export type HostingRecoveryInspection =
  Awaited<ReturnType<import("@bazion/platform-contracts").TenantHostingProvider["inspect"]>> & {
    /** Must come from provider metadata, never from the operator-supplied request body. */
    providerResourceName?: string;
    providerEnvironmentId?: string;
  };

export interface HostingProvisioningRuntime {
  providerId: string;
  environmentId: string;
  provision(input: ProvisionTenantHostingInput): Promise<ProvisionTenantHostingResult>;
  loadTemplate(template: TenantHostingTemplate): ReturnType<typeof loadTenantHostingTemplate>;
  inspect(reference: import("@bazion/platform-contracts").TenantHostingDeploymentReference): Promise<HostingRecoveryInspection>;
  stop(reference: import("@bazion/platform-contracts").TenantHostingDeploymentReference): Promise<void>;
  /** Removes the provider object while preserving its persistent volumes. */
  remove(reference: import("@bazion/platform-contracts").TenantHostingDeploymentReference): Promise<void>;
}

export function createHostingProvisioningRuntime(config: HostingRuntimeConfig): HostingProvisioningRuntime | null {
  if (config.provider === "disabled") return null;
  if (!config.dokploy) throw new Error("DOKPLOY_CONFIGURATION_REQUIRED");

  const secrets = new DockerSecretTenantHostingSecretResolver(config.secretDirectory);
  const provider = new DokployComposeProvider(config.dokploy, secrets);
  const store = new PostgresHostingProvisioningStore(pool);
  const service = new TenantHostingProvisioningService(store, provider, "dokploy");
  const templateDirectory = resolve(config.templateDirectory);

  return {
    providerId: "dokploy",
    environmentId: config.dokploy.environmentId,
    provision: (input) => service.provision(input),
    loadTemplate: (template) => loadTenantHostingTemplate(template, templateDirectory),
    inspect: async (reference) => {
      try {
        return await provider.inspect(reference) as HostingRecoveryInspection;
      } catch (error) {
        if (error instanceof Error && error.message === "DOKPLOY_RESOURCE_NOT_FOUND") {
          throw new Error("HOSTING_RESOURCE_NOT_FOUND");
        }
        throw error;
      }
    },
    stop: (reference) => provider.stop(reference),
    remove: (reference) => provider.remove(reference),
  };
}
