-- Dedicated, RLS-bound database access for tenant backups and restores.
-- This role must never own business tables or have BYPASSRLS; tenant identity is
-- supplied transaction-locally by withTenantBackupTransaction().
DO $$
DECLARE table_name text;
BEGIN
  FOR table_name IN
    SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind = 'r'
       AND c.relrowsecurity
       AND c.relforcerowsecurity
       AND EXISTS (
         SELECT 1 FROM pg_attribute a
          WHERE a.attrelid = c.oid
            AND a.attname = 'tenant_id'
            AND NOT a.attisdropped
       )
     ORDER BY c.relname
  LOOP
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO bazion_tenant_backup',
      table_name
    );
  END LOOP;
END $$;

-- Only central metadata needed to resolve the database binding and verify
-- dedicated tenant databases is visible to the backup role.
GRANT SELECT ON public.tenants, public.schema_migrations TO bazion_tenant_backup;
GRANT SELECT (tenant_id, tier, state, migration_secret_ref, schema_version)
  ON public.tenant_database_bindings TO bazion_tenant_backup;

-- Role description lives in packages/database/init/001-create-roles.sh because
-- bazion_migrator intentionally runs with NOCREATEROLE.
