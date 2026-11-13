import { z } from "zod";

export const distributionModes = ["shared-managed", "dedicated"] as const;
export const distributionModeSchema = z.enum(distributionModes);
export type DistributionMode = z.infer<typeof distributionModeSchema>;

export const sharedManagedDistributionModeSchema = z.literal("shared-managed");

export const provisioningOperationStatuses = [
  "accepted",
  "validating",
  "provisioning_tenant",
  "configuring_installation",
  "provisioning_hosting",
  "ready",
  "compensating",
  "compensation_required",
  "compensated",
  "failed",
] as const;

export const provisioningOperationStatusSchema = z.enum(provisioningOperationStatuses);
export type ProvisioningOperationStatus = z.infer<typeof provisioningOperationStatusSchema>;

export const commercialOrderProvisioningStatuses = [
  "pending",
  ...provisioningOperationStatuses,
] as const;
export const commercialOrderProvisioningStatusSchema = z.enum(commercialOrderProvisioningStatuses);

export const installationStatuses = [
  "requested",
  "provisioning",
  "ready",
  "suspended",
  "failed",
  "offboarding",
  "offboarded",
] as const;
export const installationStatusSchema = z.enum(installationStatuses);
export type InstallationStatus = z.infer<typeof installationStatusSchema>;

export const offboardedInstallationStatusSchema = z.enum(["offboarding", "offboarded"]);

