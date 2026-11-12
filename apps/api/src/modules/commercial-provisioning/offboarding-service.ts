import { createHash, randomUUID } from "node:crypto";
import type { InstallationOffboardingExport } from "@bazion/api-contracts";
import { PostgresAuditEventWriter } from "@bazion/audit";
import {
  createInstallationOffboardingExport,
  serializeInstallationOffboardingExport,
  verifyInstallationOffboardingExport,
} from "@bazion/product-installations";
import type { PrivateArchiveStorage } from "@bazion/storage";
import type { OperatorActor } from "./operator-service.js";
import type { TenantLifecycleAdapter } from "./lifecycle-service.js";
import { CommercialProvisioningError, type CommercialSqlPool } from "./service.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function iso(value: Date | string | null): string {
  if (!value) throw new CommercialProvisioningError(409, "INSTALLATION_EXPORT_INVALID", "Missing lifecycle timestamp.");
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new CommercialProvisioningError(409, "INSTALLATION_EXPORT_INVALID", "Invalid lifecycle timestamp.");
  }
  return date.toISOString();
}

export interface OffboardingArchiveSummary {
  id: string;
  tenantId: string;
  installationId: string;
  checksum: string;
  sizeBytes: number;
  createdAt: string;
  retentionExpiresAt: string;
}

/**
 * Guarded 30-day offboarding archive, recovery, and post-retention purge service.
 * Separation ensures commercial cancellation or suspension never deletes data implicitly;
 * offboarding requires explicit export + 30-day archive retention before purge.
 */
export class InstallationOffboardingService {
  constructor(
    private readonly provisionerPool: CommercialSqlPool,
    private readonly storage: PrivateArchiveStorage,
    private readonly auditWriter: PostgresAuditEventWriter,
    private readonly tenantAdapter?: TenantLifecycleAdapter,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async offboardInstallation(input: {
    tenantId: string;
    installationId: string;
    actor: OperatorActor;
    reason: string;
    confirmDestructive: boolean;
    requestId: string;
  }): Promise<{ installationId: string; status: "offboarding"; archive: OffboardingArchiveSummary }> {
    if (!UUID_REGEX.test(input.tenantId) || !UUID_REGEX.test(input.installationId)) {
      throw new CommercialProvisioningError(400, "INVALID_INPUT", "tenantId and installationId must be valid UUIDs.");
    }
    if (!input.confirmDestructive || input.reason.trim().length < 8) {
      throw new CommercialProvisioningError(
        400,
        "DESTRUCTIVE_CONFIRMATION_REQUIRED",
        "Offboarding requires explicit confirmation and a descriptive reason.",
      );
    }

    await this.auditWriter.append({
      actorType: "user",
      actorId: input.actor.userId,
      actorRole: input.actor.role,
      tenantId: input.tenantId,
      action: "commercial.installation.offboard.requested",
      resourceType: "product_installation",
      resourceId: input.installationId,
      outcome: "succeeded",
      requestId: input.requestId,
      metadata: { reasonLength: input.reason.trim().length },
    });

    const client = await this.provisionerPool.connect();
    let archiveSummary: OffboardingArchiveSummary;

    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [input.tenantId]);

      const instRes = await client.query<{
        id: string;
        tenant_id: string;
        product_id: string;
        product_version: string;
        solution_id: string;
        solution_version: string;
        template_id: string;
        template_version: string;
        configuration_schema_version: string;
        distribution_mode: "shared-managed" | "dedicated";
        status: string;
        current_configuration_version: number;
        created_by: string;
        offboarding_archive_id: string | null;
        offboarding_started_at: Date | string | null;
        created_at: Date | string;
        ready_at: Date | string | null;
        offboarded_at: Date | string | null;
      }>(
        `SELECT id::text, tenant_id::text, product_id, product_version,
                solution_id, solution_version, template_id, template_version,
                configuration_schema_version, distribution_mode, status,
                current_configuration_version, created_by,
                offboarding_archive_id::text, offboarding_started_at,
                created_at, ready_at, offboarded_at
         FROM public.product_installations
         WHERE id = $1 AND tenant_id = $2
         LIMIT 1
         FOR UPDATE`,
        [input.installationId, input.tenantId],
      );
      let installation = instRes.rows[0];
      if (!installation) {
        throw new CommercialProvisioningError(404, "INSTALLATION_NOT_FOUND", "Product installation was not found.");
      }
      if (installation.status === "offboarded") {
        throw new CommercialProvisioningError(409, "INSTALLATION_ALREADY_OFFBOARDED", "Installation is already offboarded.");
      }

      if (installation.status !== "offboarding") {
        const updated = await client.query<typeof installation>(
          `UPDATE public.product_installations
           SET status = 'offboarding'
           WHERE id = $1 AND tenant_id = $2
           RETURNING id::text, tenant_id::text, product_id, product_version,
                     solution_id, solution_version, template_id, template_version,
                     configuration_schema_version, distribution_mode, status,
                     current_configuration_version, created_by,
                     offboarding_archive_id::text, offboarding_started_at,
                     created_at, ready_at, offboarded_at`,
          [input.installationId, input.tenantId],
        );
        installation = updated.rows[0]!;
      }

      const existingArchiveRes = await client.query<{
        id: string;
        tenant_id: string;
        installation_id: string;
        archive_key: string;
        archive_checksum: string;
        object_checksum: string;
        archive_size_bytes: number;
        configuration_version: number;
        configuration_schema_version: string;
        created_at: Date | string;
        retention_expires_at: Date | string;
      }>(
        `SELECT id::text, tenant_id::text, installation_id::text, archive_key,
                archive_checksum, object_checksum, archive_size_bytes,
                configuration_version, configuration_schema_version,
                created_at, retention_expires_at
         FROM public.installation_offboarding_archives
         WHERE id = $1 AND tenant_id = $2
         LIMIT 1`,
        [installation.offboarding_archive_id, input.tenantId],
      );

      if (existingArchiveRes.rows[0]) {
        const existing = existingArchiveRes.rows[0];
        const stored = await this.storage.getArchive({
          tenantId: input.tenantId,
          key: existing.archive_key,
          checksum: existing.object_checksum,
        });
        if (!stored) {
          throw new CommercialProvisioningError(503, "OFFBOARDING_ARCHIVE_UNAVAILABLE", "Stored private archive is unavailable.");
        }
        const parsed = verifyInstallationOffboardingExport(JSON.parse(Buffer.from(stored.body).toString("utf8")));
        if (parsed.checksum !== existing.archive_checksum) {
          throw new CommercialProvisioningError(503, "OFFBOARDING_ARCHIVE_INVALID", "Stored archive checksum mismatch.");
        }
        archiveSummary = {
          id: existing.id,
          tenantId: existing.tenant_id,
          installationId: existing.installation_id,
          checksum: existing.archive_checksum,
          sizeBytes: existing.archive_size_bytes,
          createdAt: iso(existing.created_at),
          retentionExpiresAt: iso(existing.retention_expires_at),
        };
        await client.query("COMMIT");
      } else {
        const archiveId = installation.offboarding_archive_id ?? randomUUID();
        const versionsRes = await client.query<{
          id: string;
          tenant_id: string;
          installation_id: string;
          version: number;
          configuration_schema_version: string;
          configuration: Record<string, unknown>;
          checksum: string;
          created_by: string;
          created_at: Date | string;
        }>(
          `SELECT id::text, tenant_id::text, installation_id::text, version,
                  configuration_schema_version, configuration, checksum,
                  created_by, created_at
           FROM public.installation_configuration_versions
           WHERE tenant_id = $1 AND installation_id = $2
           ORDER BY version ASC`,
          [input.tenantId, input.installationId],
        );

        const envelope: InstallationOffboardingExport = createInstallationOffboardingExport({
          formatVersion: "1.0.0",
          generatedAt: iso(installation.offboarding_started_at ?? this.now()),
          installation: {
            id: installation.id,
            tenantId: installation.tenant_id,
            productId: installation.product_id,
            productVersion: installation.product_version,
            solutionId: installation.solution_id,
            solutionVersion: installation.solution_version,
            templateId: installation.template_id,
            templateVersion: installation.template_version,
            configurationSchemaVersion: installation.configuration_schema_version,
            distributionMode: installation.distribution_mode,
            status: "offboarding",
            currentConfigurationVersion: installation.current_configuration_version,
            createdBy: installation.created_by,
            createdAt: iso(installation.created_at),
            readyAt: installation.ready_at ? iso(installation.ready_at) : null,
            offboardedAt: installation.offboarded_at ? iso(installation.offboarded_at) : null,
          },
          configurationVersions: versionsRes.rows.map((v) => ({
            id: v.id,
            tenantId: v.tenant_id,
            installationId: v.installation_id,
            version: v.version,
            configurationSchemaVersion: v.configuration_schema_version,
            configuration: v.configuration,
            checksum: v.checksum,
            createdBy: v.created_by,
            createdAt: iso(v.created_at),
          })),
        });

        const body = Buffer.from(serializeInstallationOffboardingExport(envelope), "utf8");
        const stored = await this.storage.putArchive({ tenantId: input.tenantId, archiveId, body });
        const objectChecksum = createHash("sha256").update(body).digest("hex");
        if (stored.checksum !== objectChecksum || stored.sizeBytes !== body.byteLength) {
          throw new CommercialProvisioningError(503, "OFFBOARDING_ARCHIVE_INVALID", "Written archive integrity mismatch.");
        }

        const inserted = await client.query<{
          id: string;
          created_at: Date | string;
          retention_expires_at: Date | string;
        }>(
          `INSERT INTO public.installation_offboarding_archives (
             id, tenant_id, installation_id, archive_key, archive_checksum,
             object_checksum, archive_size_bytes, format_version,
             configuration_version, configuration_schema_version
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id::text, created_at, retention_expires_at`,
          [
            archiveId,
            input.tenantId,
            input.installationId,
            stored.key,
            envelope.checksum,
            objectChecksum,
            stored.sizeBytes,
            envelope.formatVersion,
            installation.current_configuration_version,
            installation.configuration_schema_version,
          ],
        );
        await client.query("COMMIT");

        archiveSummary = {
          id: inserted.rows[0]!.id,
          tenantId: input.tenantId,
          installationId: input.installationId,
          checksum: envelope.checksum,
          sizeBytes: stored.sizeBytes,
          createdAt: iso(inserted.rows[0]!.created_at),
          retentionExpiresAt: iso(inserted.rows[0]!.retention_expires_at),
        };
      }

      await this.auditWriter
        .append({
          actorType: "user",
          actorId: input.actor.userId,
          actorRole: input.actor.role,
          tenantId: input.tenantId,
          action: "commercial.installation.offboard.completed",
          resourceType: "product_installation",
          resourceId: input.installationId,
          outcome: "succeeded",
          requestId: input.requestId,
          metadata: {
            archiveId: archiveSummary.id,
            retentionExpiresAt: archiveSummary.retentionExpiresAt,
          },
        })
        .catch(() => undefined);

      return { installationId: input.installationId, status: "offboarding", archive: archiveSummary };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async restoreInstallation(input: {
    tenantId: string;
    installationId: string;
    actor: OperatorActor;
    reason: string;
    requestId: string;
  }): Promise<{ installationId: string; status: string }> {
    if (!UUID_REGEX.test(input.tenantId) || !UUID_REGEX.test(input.installationId)) {
      throw new CommercialProvisioningError(400, "INVALID_INPUT", "tenantId and installationId must be valid UUIDs.");
    }

    const client = await this.provisionerPool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [input.tenantId]);

      const archiveRes = await client.query<{
        id: string;
        archive_key: string;
        archive_checksum: string;
        object_checksum: string;
        retention_expires_at: Date | string;
      }>(
        `SELECT a.id::text, a.archive_key, a.archive_checksum, a.object_checksum, a.retention_expires_at
         FROM public.installation_offboarding_archives a
         JOIN public.product_installations i ON i.id = a.installation_id AND i.tenant_id = a.tenant_id
         WHERE a.tenant_id = $1
           AND a.installation_id = $2
           AND i.status = 'offboarding'
           AND a.id = i.offboarding_archive_id
           AND a.recovered_at IS NULL
           AND a.archive_purged_at IS NULL
         LIMIT 1
         FOR UPDATE OF a`,
        [input.tenantId, input.installationId],
      );
      const archive = archiveRes.rows[0];
      if (!archive) {
        throw new CommercialProvisioningError(409, "OFFBOARDING_ARCHIVE_NOT_FOUND", "No recoverable installation archive was found.");
      }

      if (new Date(archive.retention_expires_at).getTime() <= this.now().getTime()) {
        throw new CommercialProvisioningError(409, "OFFBOARDING_RECOVERY_EXPIRED", "The 30-day recovery window has expired.");
      }

      const stored = await this.storage.getArchive({
        tenantId: input.tenantId,
        key: archive.archive_key,
        checksum: archive.object_checksum,
      });
      if (!stored) {
        throw new CommercialProvisioningError(503, "OFFBOARDING_ARCHIVE_UNAVAILABLE", "Private archive is unavailable.");
      }
      const verified = verifyInstallationOffboardingExport(JSON.parse(Buffer.from(stored.body).toString("utf8")));
      if (verified.checksum !== archive.archive_checksum) {
        throw new CommercialProvisioningError(503, "OFFBOARDING_ARCHIVE_INVALID", "Stored archive checksum mismatch.");
      }

      const restoredInst = await client.query<{ status: string }>(
        `UPDATE public.product_installations
         SET status = offboarding_previous_status
         WHERE id = $1 AND tenant_id = $2 AND status = 'offboarding' AND offboarding_previous_status IS NOT NULL
         RETURNING status`,
        [input.installationId, input.tenantId],
      );
      if (!restoredInst.rows[0]) {
        throw new CommercialProvisioningError(409, "OFFBOARDING_RECOVERY_CONFLICT", "Installation cannot be recovered.");
      }

      await client.query(
        `UPDATE public.installation_offboarding_archives
         SET recovered_at = now(), recovered_by = $3
         WHERE id = $1 AND tenant_id = $2`,
        [archive.id, input.tenantId, input.actor.userId],
      );
      await client.query("COMMIT");

      const restoredStatus = restoredInst.rows[0].status;
      if (restoredStatus === "ready" && this.tenantAdapter) {
        await this.tenantAdapter.setTenantStatus(input.tenantId, "restore").catch(() => undefined);
      }

      await this.auditWriter
        .append({
          actorType: "user",
          actorId: input.actor.userId,
          actorRole: input.actor.role,
          tenantId: input.tenantId,
          action: "commercial.installation.restore.completed",
          resourceType: "product_installation",
          resourceId: input.installationId,
          outcome: "succeeded",
          requestId: input.requestId,
          metadata: { archiveId: archive.id, restoredStatus, reasonLength: input.reason.length },
        })
        .catch(() => undefined);

      return { installationId: input.installationId, status: restoredStatus };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async purgeExpiredArchivesForTenant(input: {
    tenantId: string;
    asOf?: Date;
    actor: OperatorActor;
    requestId: string;
  }): Promise<{ archivesScanned: number; configurationsDeleted: number; archivesDeleted: number }> {
    const asOf = input.asOf ?? this.now();
    const client = await this.provisionerPool.connect();
    let archivesScanned = 0;
    let configurationsDeleted = 0;
    let archivesDeleted = 0;

    try {
      await client.query("BEGIN");
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [input.tenantId]);
      const candidates = await client.query<{
        id: string;
        installation_id: string;
        archive_key: string;
        object_checksum: string;
        recovered_at: Date | string | null;
        configuration_purged_at: Date | string | null;
      }>(
        `SELECT id::text, installation_id::text, archive_key, object_checksum,
                recovered_at, configuration_purged_at
         FROM public.installation_offboarding_archives
         WHERE tenant_id = $1
           AND archive_purged_at IS NULL
           AND retention_expires_at <= $2
         ORDER BY retention_expires_at ASC
         LIMIT 100
         FOR UPDATE`,
        [input.tenantId, asOf.toISOString()],
      );
      archivesScanned = candidates.rows.length;

      for (const candidate of candidates.rows) {
        if (!candidate.recovered_at && !candidate.configuration_purged_at) {
          await client.query(
            `UPDATE public.product_installations
             SET status = 'offboarded'
             WHERE id = $1 AND tenant_id = $2 AND status = 'offboarding'`,
            [candidate.installation_id, input.tenantId],
          );
          const deleted = await client.query(
            `DELETE FROM public.installation_configuration_versions
             WHERE tenant_id = $1 AND installation_id = $2`,
            [input.tenantId, candidate.installation_id],
          );
          configurationsDeleted += deleted.rowCount ?? 0;
          await client.query(
            `UPDATE public.installation_offboarding_archives
             SET configuration_purged_at = now()
             WHERE id = $1 AND tenant_id = $2 AND configuration_purged_at IS NULL`,
            [candidate.id, input.tenantId],
          );
        }

        await this.storage.deleteArchive({
          tenantId: input.tenantId,
          key: candidate.archive_key,
          checksum: candidate.object_checksum,
        });
        await client.query(
          `UPDATE public.installation_offboarding_archives
           SET archive_purged_at = now()
           WHERE id = $1 AND tenant_id = $2 AND archive_purged_at IS NULL`,
          [candidate.id, input.tenantId],
        );
        archivesDeleted += 1;
      }

      await client.query("COMMIT");

      if (archivesDeleted > 0) {
        await this.auditWriter
          .append({
            actorType: "user",
            actorId: input.actor.userId,
            actorRole: input.actor.role,
            tenantId: input.tenantId,
            action: "commercial.installation.retention_purge.completed",
            resourceType: "installation_offboarding_archive",
            resourceId: input.tenantId,
            outcome: "succeeded",
            requestId: input.requestId,
            metadata: { archivesScanned, configurationsDeleted, archivesDeleted },
          })
          .catch(() => undefined);
      }

      return { archivesScanned, configurationsDeleted, archivesDeleted };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}
