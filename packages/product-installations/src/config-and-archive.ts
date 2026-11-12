import { createHash } from "node:crypto";
import {
  customerConfigurationSchema,
  installationConfigurationSnapshotInputSchema,
  installationConfigurationSnapshotSchema,
  installationExportEnvelopeSchema,
  installationExportInputSchema,
  installedProductVersionSchema,
  type InstallationConfigurationSnapshot,
  type InstallationOffboardingExport,
} from "@bazion/api-contracts";

export interface InstallationConfigurationTransform {
  fromSchemaVersion: string;
  toSchemaVersion: string;
  validateSource(source: Readonly<Record<string, unknown>>): Record<string, unknown>;
  validateTarget(target: unknown): Record<string, unknown>;
  transform(source: Readonly<Record<string, unknown>>): unknown;
}

export interface ConfigurationTransformPlanInput {
  tenantId: string;
  installationId: string;
  currentSchemaVersion: string;
  targetSchemaVersion: string;
  currentConfigurationVersion: number;
  configuration: Record<string, unknown>;
  createdBy: string;
  transforms: readonly InstallationConfigurationTransform[];
}

export interface ConfigurationTransformPlan {
  snapshots: InstallationConfigurationSnapshot[];
  finalSchemaVersion: string;
  finalConfigurationVersion: number;
  finalConfiguration: Record<string, unknown>;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertUuid(value: string, label: string): string {
  if (!UUID_REGEX.test(value)) throw new RangeError(`${label} must be a valid UUID.`);
  return value.toLowerCase();
}

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v === undefined ? null : v)).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(",")}}`;
}

export function createInstallationConfigurationChecksum(
  configurationSchemaVersion: string,
  configuration: unknown,
): string {
  const parsedVersion = installedProductVersionSchema.parse(configurationSchemaVersion);
  const parsedConfiguration = customerConfigurationSchema.parse(configuration);
  return createHash("sha256")
    .update(canonicalJson({ configurationSchemaVersion: parsedVersion, configuration: parsedConfiguration }))
    .digest("hex");
}

export function prepareInstallationConfigurationSnapshot(
  input: Omit<InstallationConfigurationSnapshot, "checksum">,
): InstallationConfigurationSnapshot {
  const parsed = installationConfigurationSnapshotInputSchema.parse(input);
  return installationConfigurationSnapshotSchema.parse({
    ...parsed,
    checksum: createInstallationConfigurationChecksum(parsed.configurationSchemaVersion, parsed.configuration),
  });
}

export function nextInstallationConfigurationVersion(currentVersion: number): number {
  if (!Number.isSafeInteger(currentVersion) || currentVersion < 0 || currentVersion >= 2_147_483_647) {
    throw new RangeError("The current configuration version must be a non-negative supported integer.");
  }
  return currentVersion + 1;
}

function compareProductVersions(left: string, right: string): number {
  const leftParts = installedProductVersionSchema.parse(left).split(".").map(BigInt);
  const rightParts = installedProductVersionSchema.parse(right).split(".").map(BigInt);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index]! < rightParts[index]!) return -1;
    if (leftParts[index]! > rightParts[index]!) return 1;
  }
  return 0;
}

function deeplyFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deeplyFreeze(nested);
  }
  return value;
}

/**
 * Validates and plans an ordered, forward-only configuration migration.
 * Never edits persisted history; callers append snapshots in one transaction.
 */
export function planInstallationConfigurationTransform(
  input: ConfigurationTransformPlanInput,
): ConfigurationTransformPlan {
  const tenantId = assertUuid(input.tenantId, "tenantId");
  const installationId = assertUuid(input.installationId, "installationId");
  const createdBy = input.createdBy.trim();
  if (createdBy.length < 1 || createdBy.length > 128) {
    throw new RangeError("createdBy must be between 1 and 128 characters.");
  }
  let schemaVersion = installedProductVersionSchema.parse(input.currentSchemaVersion);
  const targetSchemaVersion = installedProductVersionSchema.parse(input.targetSchemaVersion);
  let configurationVersion = input.currentConfigurationVersion;
  let configuration = customerConfigurationSchema.parse(input.configuration);
  if (!Number.isSafeInteger(configurationVersion) || configurationVersion < 0 || configurationVersion >= 2_147_483_647) {
    throw new RangeError("The current configuration version must be a non-negative supported integer.");
  }
  if (compareProductVersions(targetSchemaVersion, schemaVersion) < 0) {
    throw new RangeError("Configuration transforms cannot move a schema version backwards.");
  }

  const bySourceVersion = new Map<string, InstallationConfigurationTransform>();
  for (const transform of input.transforms) {
    const from = installedProductVersionSchema.parse(transform.fromSchemaVersion);
    const to = installedProductVersionSchema.parse(transform.toSchemaVersion);
    if (compareProductVersions(to, from) <= 0) {
      throw new RangeError(`Configuration transform ${from} -> ${to} must move forward.`);
    }
    if (bySourceVersion.has(from)) {
      throw new RangeError(`More than one configuration transform starts at ${from}.`);
    }
    bySourceVersion.set(from, transform);
  }

  const snapshots: InstallationConfigurationSnapshot[] = [];
  const visited = new Set<string>();
  while (compareProductVersions(schemaVersion, targetSchemaVersion) < 0) {
    if (visited.has(schemaVersion)) {
      throw new RangeError("Configuration transform path contains a cycle.");
    }
    visited.add(schemaVersion);
    const transform = bySourceVersion.get(schemaVersion);
    if (!transform) {
      throw new RangeError(`No configuration transform registered from ${schemaVersion}.`);
    }
    const immutableSource = deeplyFreeze(transform.validateSource(structuredClone(configuration)));
    const transformed = transform.transform(immutableSource);
    const parsedTarget = customerConfigurationSchema.parse(transform.validateTarget(transformed));
    configurationVersion = nextInstallationConfigurationVersion(configurationVersion);
    schemaVersion = transform.toSchemaVersion;
    configuration = parsedTarget;
    snapshots.push(
      prepareInstallationConfigurationSnapshot({
        tenantId,
        installationId,
        version: configurationVersion,
        configurationSchemaVersion: schemaVersion,
        configuration,
        createdBy,
      }),
    );
  }

  return {
    snapshots,
    finalSchemaVersion: schemaVersion,
    finalConfigurationVersion: configurationVersion,
    finalConfiguration: structuredClone(configuration),
  };
}

/** Creates a complete, deterministic export envelope suitable for tenant-owned object storage. */
export function createInstallationOffboardingExport(
  input: Omit<InstallationOffboardingExport, "checksum">,
): InstallationOffboardingExport {
  const parsed = installationExportInputSchema.parse(input);
  const installation = parsed.installation;
  const versions = [...parsed.configurationVersions].sort((left, right) => left.version - right.version);
  if (installation.currentConfigurationVersion !== versions.length) {
    throw new RangeError("The export must contain every configuration version through the installation's current version.");
  }
  versions.forEach((version, index) => {
    if (
      version.version !== index + 1
      || version.tenantId !== installation.tenantId
      || version.installationId !== installation.id
    ) {
      throw new RangeError("Configuration export versions must be contiguous and belong to this tenant installation.");
    }
    if (version.checksum !== createInstallationConfigurationChecksum(version.configurationSchemaVersion, version.configuration)) {
      throw new RangeError(`Configuration version ${version.version} failed checksum validation.`);
    }
  });
  if (versions.length > 0 && versions.at(-1)!.configurationSchemaVersion !== installation.configurationSchemaVersion) {
    throw new RangeError("The latest configuration snapshot must match the installation's current schema version.");
  }

  const envelope = {
    formatVersion: parsed.formatVersion,
    generatedAt: parsed.generatedAt,
    installation,
    configurationVersions: versions,
  };
  const serialized = canonicalJson(envelope);
  if (Buffer.byteLength(serialized, "utf8") > 50 * 1024 * 1024) {
    throw new RangeError("Installation exports are limited to 50 MiB per archive.");
  }
  return { ...envelope, checksum: createHash("sha256").update(serialized).digest("hex") };
}

/** Parses a stored export and recomputes the canonical envelope and snapshot checksums. */
export function verifyInstallationOffboardingExport(input: unknown): InstallationOffboardingExport {
  const parsed = installationExportEnvelopeSchema.parse(input);
  const { checksum, ...envelope } = parsed;
  const verified = createInstallationOffboardingExport(envelope);
  if (verified.checksum !== checksum) {
    throw new Error("Installation export envelope checksum does not match its contents.");
  }
  return verified;
}

/** Serializes a verified export in canonical form for byte-stable retries. */
export function serializeInstallationOffboardingExport(input: InstallationOffboardingExport): string {
  return canonicalJson(verifyInstallationOffboardingExport(input));
}

