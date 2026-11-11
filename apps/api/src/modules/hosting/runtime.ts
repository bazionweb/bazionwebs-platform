import { resolve } from "node:path";
import { DokployComposeProvider, type DokployConfig } from "@bazion/deployment-dokploy";
import { pool } from "../../lib/database.js";
import { PostgresHostingProvisioningStore, TenantHostingProvisioningService } from "./provisioning.js";
import { DockerSecretTenantHostingSecretResolver } from "./secrets.js";
import { loadTenantHostingTemplate } from "./templates.js";
import type { TenantHostingTemplate } from "@bazion/platform-contracts";

export interface HostingRuntimeConfig {
  provider: "disabled" | "dokploy";
  secretDirectory: string;
  templateDirectory: string;
  dokploy: DokployConfig | null;
}

export interface HostingProvisioningRuntime {
  providerId: string;
  provision: TenantHostingProvisioningService["provision"] extends (...args: infer A) => infer R
    ? (...args: A) => R
    : never;
  loadTemplate(template: TenantHostingTemplate): ReturnType<typeof loadTenantHostingTemplate>;
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
    provision: (input) => service.provision(input),
    loadTemplate: (template) => loadTenantHostingTemplate(template, templateDirectory),
  };
}
