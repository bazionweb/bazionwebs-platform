/**
 * Migrations required by the current platform schema. Keep this list in sync
 * with the files in ../migrations; migration-registry.test.ts enforces parity.
 */
export const requiredDatabaseMigrations = [
  "0001_initial.sql",
  "0002_auth_tenant_registry.sql",
  "0003_notification_outbox.sql",
  "0004_notification_runtime_roles.sql",
  "0005_platform_audit_events.sql",
  "0006_tenant_lifecycle.sql",
  "0007_platform_tenant_control_plane.sql",
  "0008_church_ministry_domain.sql",
  "0009_church_integrity_and_payment_callbacks.sql",
  "0010_commerce_mpesa_callbacks.sql",
  "0011_church_site_and_privacy.sql",
  "0012_ecommerce_template.sql",
  "0013_tenant_database_routing.sql",
  "0014_global_mission_commerce_entitlement.sql",
  "0015_commerce_inventory_reservation_guard.sql",
  "0016_forms_leads_site_enquiries.sql",
  "0016_tenant_hosting_deployments.sql",
  "0017_hosting_reconciliation_schedule.sql",
  "0018_hosting_provider_lifecycle.sql",
  "0018_product_installations_provisioning_sagas.sql",
  "0019_commercial_provisioning_delivery.sql",
  "0019_tenant_backup_restore_access.sql",
  "0020_phase5_identity_oidc_bff.sql",
  "0021_phase6_saga_leases_lifecycle_archive.sql",
  "0022_phase4_hosting_deployment_projection.sql",
  "0023_product_provisioner_hosting_identity_read.sql",
  "0024_commercial_platform_hardening.sql",
  "0025_installation_changes.sql",
  "0026_church_ministry_operations.sql",
  "0027_church_site_settings_versions.sql",
] as const;

/** Current tenant database release marker; updates automatically with the registry. */
export const currentDatabaseSchemaVersion = requiredDatabaseMigrations.at(-1)!;
