export const COMMERCIAL_PLATFORM_CONTRACT_NAME = "bazion-commercial-platform-v1" as const;

export type ContractWireDirection =
  | "commercial_to_platform"
  | "platform_to_commercial";

export interface PublishedContractDescriptor {
  readonly schemaName: string;
  readonly schemaId: string;
  readonly fileName: string;
  readonly direction: ContractWireDirection;
  readonly currentVersion: "1.0.0";
  readonly minimumSupportedVersion: "1.0.0";
}

/**
 * Compatibility and lifecycle governance metadata shared by Bazionweb (commercial control plane)
 * and Bazion Platform (product delivery plane).
 */
export const CONTRACT_COMPATIBILITY_V1 = {
  contractName: COMMERCIAL_PLATFORM_CONTRACT_NAME,
  currentVersion: "1.0.0",
  minimumSupportedVersion: "1.0.0",
  supportedVersions: ["1.0.0"] as const,
  deprecationWindowDays: 90,
  upgradeIdentificationRule: {
    orderLineKeyFormat: "<orderId>:line:<index>",
    targetIdentifierField: "targetInstallationId",
    mutatePinnedCompositionInPlace: false,
  },
  piiBoundaryPolicy: {
    transientCustomerFields: ["customer.displayName", "customer.primaryContact"] as const,
    persistedInPlatformDeliveryTables: false,
    redactedInStructuredLogs: true,
    normalizePrimaryContactOnEmission: true,
  },
  evolutionRules: {
    additiveChanges: "Backward-compatible optional response/event fields increment minor version (1.x.0) without breaking existing 1.0.0 consumers; strict command/event requests remain reject-unknown-fields until an explicit minor/major bump is negotiated.",
    breakingChanges: "Field removals, required-field tightening, enum narrowing, or semantic redefinitions require a major version (2.0.0) and a minimum 90-day dual-version deprecation window.",
    unsupportedVersionBehavior: "Reject unsupported or below-minimum schemaVersion with 400 validation failure before starting any provisioning workflow or database mutation.",
  },
  contracts: [
    {
      schemaName: "provisionProductRequestV1",
      schemaId: "https://schemas.bazionweb.com/platform/provision-product-request/1.0.0",
      fileName: "provision-product-request-v1.schema.json",
      direction: "commercial_to_platform",
      currentVersion: "1.0.0",
      minimumSupportedVersion: "1.0.0",
    },
    {
      schemaName: "provisioningOfferCatalogV1",
      schemaId: "https://schemas.bazionweb.com/platform/provisioning-offer-catalog/1.0.0",
      fileName: "provisioning-offer-catalog-v1.schema.json",
      direction: "platform_to_commercial",
      currentVersion: "1.0.0",
      minimumSupportedVersion: "1.0.0",
    },
    {
      schemaName: "provisioningOperationV1",
      schemaId: "https://schemas.bazionweb.com/platform/provisioning-operation/1.0.0",
      fileName: "provisioning-operation-v1.schema.json",
      direction: "platform_to_commercial",
      currentVersion: "1.0.0",
      minimumSupportedVersion: "1.0.0",
    },
    {
      schemaName: "provisioningStatusEventV1",
      schemaId: "https://schemas.bazionweb.com/platform/provisioning-status-event/1.0.0",
      fileName: "provisioning-status-event-v1.schema.json",
      direction: "platform_to_commercial",
      currentVersion: "1.0.0",
      minimumSupportedVersion: "1.0.0",
    },
    {
      schemaName: "subscriptionLifecycleCommandV1",
      schemaId: "https://schemas.bazionweb.com/platform/subscription-lifecycle-command/1.0.0",
      fileName: "subscription-lifecycle-command-v1.schema.json",
      direction: "commercial_to_platform",
      currentVersion: "1.0.0",
      minimumSupportedVersion: "1.0.0",
    },
    {
      schemaName: "subscriptionLifecycleStatusEventV1",
      schemaId: "https://schemas.bazionweb.com/platform/subscription-lifecycle-status-event/1.0.0",
      fileName: "subscription-lifecycle-status-event-v1.schema.json",
      direction: "platform_to_commercial",
      currentVersion: "1.0.0",
      minimumSupportedVersion: "1.0.0",
    },
  ] satisfies readonly PublishedContractDescriptor[],
} as const;

const SEMVER_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

function compareSemver(left: string, right: string): number {
  const l = SEMVER_PATTERN.exec(left.trim());
  const r = SEMVER_PATTERN.exec(right.trim());
  if (!l || !r) return Number.NaN;
  for (let i = 1; i <= 3; i += 1) {
    const diff = Number(l[i]) - Number(r[i]);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function isSupportedContractVersion(version: unknown): version is "1.0.0" {
  return (
    typeof version === "string"
    && (CONTRACT_COMPATIBILITY_V1.supportedVersions as readonly string[]).includes(version.trim())
  );
}

export function evaluateContractVersionCompatibility(version: unknown) {
  if (typeof version !== "string" || !SEMVER_PATTERN.test(version.trim())) {
    return {
      supported: false,
      reason: "malformed" as const,
      currentVersion: CONTRACT_COMPATIBILITY_V1.currentVersion,
      minimumSupportedVersion: CONTRACT_COMPATIBILITY_V1.minimumSupportedVersion,
      deprecationWindowDays: CONTRACT_COMPATIBILITY_V1.deprecationWindowDays,
    };
  }

  const trimmed = version.trim();
  if (isSupportedContractVersion(trimmed)) {
    return {
      supported: true,
      reason: "supported" as const,
      currentVersion: CONTRACT_COMPATIBILITY_V1.currentVersion,
      minimumSupportedVersion: CONTRACT_COMPATIBILITY_V1.minimumSupportedVersion,
      deprecationWindowDays: CONTRACT_COMPATIBILITY_V1.deprecationWindowDays,
    };
  }

  const minCmp = compareSemver(trimmed, CONTRACT_COMPATIBILITY_V1.minimumSupportedVersion);
  if (minCmp < 0) {
    return {
      supported: false,
      reason: "below_minimum" as const,
      currentVersion: CONTRACT_COMPATIBILITY_V1.currentVersion,
      minimumSupportedVersion: CONTRACT_COMPATIBILITY_V1.minimumSupportedVersion,
      deprecationWindowDays: CONTRACT_COMPATIBILITY_V1.deprecationWindowDays,
    };
  }

  const currentMajor = Number(CONTRACT_COMPATIBILITY_V1.currentVersion.split(".")[0]);
  const incomingMajor = Number(trimmed.split(".")[0]);
  return {
    supported: false,
    reason: incomingMajor !== currentMajor ? ("unsupported_major" as const) : ("unknown_version" as const),
    currentVersion: CONTRACT_COMPATIBILITY_V1.currentVersion,
    minimumSupportedVersion: CONTRACT_COMPATIBILITY_V1.minimumSupportedVersion,
    deprecationWindowDays: CONTRACT_COMPATIBILITY_V1.deprecationWindowDays,
  };
}

