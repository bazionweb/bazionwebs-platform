import { z } from "zod";

export const installedProductVersionSchema = z.string().max(40).regex(/^\d+\.\d+\.\d+$/);
export const productIdentifierSchema = z.string().max(80).regex(/^[a-z][a-z0-9-]*$/);

const forbiddenConfigurationKey = /(?:password|secret|credential|token|private[-_]?key|api[-_]?key)/i;

const jsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

function findForbiddenKeys(value: unknown, path: string[] = []): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => findForbiddenKeys(entry, [...path, String(index)]));
  }
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, entry]) => [
    ...(forbiddenConfigurationKey.test(key) ? [[...path, key].join(".")] : []),
    ...findForbiddenKeys(entry, [...path, key]),
  ]);
}

export const customerConfigurationSchema = z
  .record(z.string(), jsonValueSchema)
  .superRefine((configuration, context) => {
    for (const path of findForbiddenKeys(configuration)) {
      context.addIssue({
        code: "custom",
        message: "Configuration snapshots cannot contain credentials or secret material.",
        path: [path],
      });
    }
  });

export const installationConfigurationSnapshotInputSchema = z
  .object({
    tenantId: z.string().uuid(),
    installationId: z.string().uuid(),
    version: z.number().int().min(1).max(2_147_483_647),
    configurationSchemaVersion: installedProductVersionSchema,
    configuration: customerConfigurationSchema,
    createdBy: z.string().trim().min(1).max(128),
  })
  .strict();

export const installationConfigurationSnapshotSchema = installationConfigurationSnapshotInputSchema.extend({
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
});
export type InstallationConfigurationSnapshot = z.infer<typeof installationConfigurationSnapshotSchema>;

export const exportedInstallationSchema = z
  .object({
    id: z.string().uuid(),
    tenantId: z.string().uuid(),
    productId: productIdentifierSchema,
    productVersion: installedProductVersionSchema,
    solutionId: productIdentifierSchema,
    solutionVersion: installedProductVersionSchema,
    templateId: productIdentifierSchema,
    templateVersion: installedProductVersionSchema,
    configurationSchemaVersion: installedProductVersionSchema,
    distributionMode: z.enum(["shared-managed", "dedicated"]),
    status: z.enum(["offboarding", "offboarded"]),
    currentConfigurationVersion: z.number().int().min(0).max(2_147_483_647),
    createdBy: z.string().min(1).max(128),
    createdAt: z.iso.datetime(),
    readyAt: z.iso.datetime().nullable(),
    offboardedAt: z.iso.datetime().nullable(),
  })
  .strict();

export const exportedConfigurationVersionSchema = installationConfigurationSnapshotSchema.extend({
  id: z.string().uuid(),
  createdAt: z.iso.datetime(),
});

export const installationExportInputSchema = z
  .object({
    formatVersion: installedProductVersionSchema,
    generatedAt: z.iso.datetime(),
    installation: exportedInstallationSchema,
    configurationVersions: z.array(exportedConfigurationVersionSchema).max(10_000),
  })
  .strict();

export const installationExportEnvelopeSchema = installationExportInputSchema.extend({
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
});

export type InstallationOffboardingExport = z.infer<typeof installationExportEnvelopeSchema>;

