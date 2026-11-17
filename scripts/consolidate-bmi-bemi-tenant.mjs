import pg from "../apps/api/node_modules/pg/lib/index.js";

const CANONICAL_TENANT_ID = "00000000-0000-4000-8000-000000000055";
const LEGACY_BEMI_TENANT_ID = "00000000-0000-4000-8000-000000000056";
const IMMUTABLE_HISTORY_TABLES = new Set(["platform_audit_events"]);
const args = new Set(process.argv.slice(2));

if ([...args].some((arg) => arg !== "--apply" && arg !== "--help")) {
  console.error("Usage: node scripts/consolidate-bmi-bemi-tenant.mjs [--apply]");
  process.exitCode = 2;
  process.exit();
}

if (args.has("--help")) {
  console.log("Runs a read-only BMI/BEMI consolidation preflight by default.");
  console.log("Pass --apply to consolidate safe registry rows and close legacy tenant 056.");
  process.exit(0);
}

const apply = args.has("--apply");
const client = new pg.Client({
  connectionString:
    process.env.MIGRATION_DATABASE_URL ||
    process.env.DATABASE_URL ||
    "postgres://postgres:postgres@localhost:5432/bazion_platform",
});

function quoteIdentifier(value) {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) {
    throw new Error(`Unexpected database identifier: ${value}`);
  }
  return `"${value}"`;
}

async function getTenantScopedTables() {
  const result = await client.query(`
    SELECT c.relname AS table_name
    FROM pg_catalog.pg_class AS c
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND EXISTS (
        SELECT 1 FROM pg_catalog.pg_attribute AS a
        WHERE a.attrelid = c.oid AND a.attname = 'tenant_id'
          AND a.attnum > 0 AND NOT a.attisdropped
      )
    ORDER BY c.relname
  `);
  return result.rows.map((row) => row.table_name);
}

async function countTenantRows(tableName, tenantId) {
  const result = await client.query(
    `SELECT count(*)::text AS row_count FROM public.${quoteIdentifier(tableName)} WHERE tenant_id::text = $1`,
    [tenantId],
  );
  return Number(result.rows[0].row_count);
}

async function getRegistryRows(tableName, columns, tenantId) {
  const safeColumns = columns.map(quoteIdentifier).join(", ");
  const result = await client.query(
    `SELECT ${safeColumns} FROM public.${quoteIdentifier(tableName)} WHERE tenant_id = $1`,
    [tenantId],
  );
  return result.rows[0] ?? null;
}

async function hasTable(tableName) {
  const result = await client.query(
    `SELECT to_regclass($1) IS NOT NULL AS present`,
    [`public.${tableName}`],
  );
  return result.rows[0].present;
}

async function preflight() {
  const requiredTables = ["tenants", "tenant_domains", "tenant_module_entitlements"];
  for (const tableName of requiredTables) {
    if (!(await hasTable(tableName))) {
      throw new Error(`Required table public.${tableName} is missing; apply database migrations first.`);
    }
  }

  let tenantResult = await client.query(
    `SELECT id, slug, name, status, auth_organization_id
       FROM public.tenants
      WHERE id = ANY($1::uuid[])
      ORDER BY id`,
    [[CANONICAL_TENANT_ID, LEGACY_BEMI_TENANT_ID]],
  );
  let tenants = new Map(tenantResult.rows.map((row) => [row.id, row]));
  let canonical = tenants.get(CANONICAL_TENANT_ID);
  let legacy = tenants.get(LEGACY_BEMI_TENANT_ID);
  const blockers = [];

  if (!canonical) {
    blockers.push(`Canonical BMI tenant ${CANONICAL_TENANT_ID} does not exist.`);
  }
  if (!legacy) {
    return { canonical, legacy, blockers, tableCounts: new Map(), noOp: true };
  }
  if (canonical && canonical.slug !== "bmi") {
    blockers.push(`Canonical tenant ID is assigned to unexpected slug "${canonical.slug}".`);
  }
  if (canonical && canonical.status !== "active") {
    blockers.push(`Canonical BMI tenant is ${canonical.status}; activate it before consolidating BEMI.`);
  }
  if (legacy.slug !== "bemi") {
    blockers.push(`Legacy BEMI tenant ID is assigned to unexpected slug "${legacy.slug}".`);
  }

  const tableNames = await getTenantScopedTables();
  if (apply) {
    for (const tableName of tableNames) {
      if (IMMUTABLE_HISTORY_TABLES.has(tableName)) continue;
      await client.query(
        `LOCK TABLE public.${quoteIdentifier(tableName)} IN SHARE ROW EXCLUSIVE MODE`,
      );
    }

    tenantResult = await client.query(
      `SELECT id, slug, name, status, auth_organization_id
         FROM public.tenants
        WHERE id = ANY($1::uuid[])
        ORDER BY id FOR UPDATE`,
      [[CANONICAL_TENANT_ID, LEGACY_BEMI_TENANT_ID]],
    );
    tenants = new Map(tenantResult.rows.map((row) => [row.id, row]));
    canonical = tenants.get(CANONICAL_TENANT_ID);
    legacy = tenants.get(LEGACY_BEMI_TENANT_ID);
    if (!canonical) blockers.push(`Canonical BMI tenant ${CANONICAL_TENANT_ID} does not exist.`);
    if (!legacy) return { canonical, legacy, blockers, tableCounts: new Map(), noOp: true };
    if (canonical && canonical.slug !== "bmi") {
      blockers.push(`Canonical tenant ID is assigned to unexpected slug "${canonical.slug}".`);
    }
    if (canonical && canonical.status !== "active") {
      blockers.push(`Canonical BMI tenant is ${canonical.status}; activate it before consolidating BEMI.`);
    }
    if (legacy.slug !== "bemi") {
      blockers.push(`Legacy BEMI tenant ID is assigned to unexpected slug "${legacy.slug}".`);
    }
  }

  if (
    canonical?.auth_organization_id && legacy.auth_organization_id &&
    canonical.auth_organization_id !== legacy.auth_organization_id
  ) {
    blockers.push("BMI and BEMI are linked to different Better Auth organizations; merge identity data before consolidation.");
  }

  const tableCounts = new Map();
  for (const tableName of tableNames) {
    if (IMMUTABLE_HISTORY_TABLES.has(tableName)) continue;
    const count = await countTenantRows(tableName, LEGACY_BEMI_TENANT_ID);
    if (count > 0) tableCounts.set(tableName, count);
  }
  const domainSummaryResult = canonical
    ? await client.query(
        `SELECT count(*)::text AS total,
                count(*) FILTER (WHERE status = 'active' AND verified_at IS NOT NULL)::text AS active_verified
           FROM public.tenant_domains
          WHERE tenant_id = $1`,
        [CANONICAL_TENANT_ID],
      )
    : null;
  const domainSummary = domainSummaryResult
    ? {
        total: Number(domainSummaryResult.rows[0].total),
        activeVerified: Number(domainSummaryResult.rows[0].active_verified),
      }
    : null;

  const safeTables = new Set([
    "tenant_domains",
    "tenant_module_entitlements",
    "tenant_platform_settings",
    "tenant_database_bindings",
  ]);
  for (const [tableName, count] of tableCounts) {
    if (!safeTables.has(tableName)) {
      blockers.push(`${tableName}: ${count} tenant-scoped row(s) need a data-specific merge plan.`);
    }
  }

  if (await hasTable("tenant_platform_settings")) {
    const canonicalSettings = await getRegistryRows(
      "tenant_platform_settings", ["settings", "version"], CANONICAL_TENANT_ID,
    );
    const legacySettings = await getRegistryRows(
      "tenant_platform_settings", ["settings", "version"], LEGACY_BEMI_TENANT_ID,
    );
    if (
      canonicalSettings && legacySettings &&
      (JSON.stringify(canonicalSettings.settings) !== JSON.stringify(legacySettings.settings) ||
        canonicalSettings.version !== legacySettings.version)
    ) {
      blockers.push("BMI and BEMI have different platform settings; reconcile the settings before consolidation.");
    }
  }

  if (await hasTable("tenant_database_bindings")) {
    const columns = ["tier", "state", "runtime_secret_ref", "migration_secret_ref", "schema_version"];
    const canonicalBinding = await getRegistryRows(
      "tenant_database_bindings", columns, CANONICAL_TENANT_ID,
    );
    const legacyBinding = await getRegistryRows(
      "tenant_database_bindings", columns, LEGACY_BEMI_TENANT_ID,
    );
    if (
      canonicalBinding && legacyBinding &&
      columns.some((column) => canonicalBinding[column] !== legacyBinding[column])
    ) {
      blockers.push("BMI and BEMI have different database routing bindings; reconcile routing before consolidation.");
    }
  }

  const noOp = legacy.status === "closed" && tableCounts.size === 0 && !legacy.auth_organization_id;
  return { canonical, legacy, blockers, tableCounts, domainSummary, noOp };
}

async function applyConsolidation() {
  await client.query(
    `UPDATE public.tenant_domains
        SET tenant_id = $1
      WHERE tenant_id = $2`,
    [CANONICAL_TENANT_ID, LEGACY_BEMI_TENANT_ID],
  );

  await client.query(
    `INSERT INTO public.tenant_module_entitlements AS current_entitlement
       (tenant_id, module_id, enabled, updated_by, created_at, updated_at)
     SELECT $1, module_id, enabled, 'system:bmi-bemi-consolidation', created_at, now()
       FROM public.tenant_module_entitlements
      WHERE tenant_id = $2
     ON CONFLICT (tenant_id, module_id) DO UPDATE
       SET enabled = current_entitlement.enabled OR EXCLUDED.enabled,
           updated_by = 'system:bmi-bemi-consolidation',
           updated_at = now()`,
    [CANONICAL_TENANT_ID, LEGACY_BEMI_TENANT_ID],
  );
  await client.query(
    "DELETE FROM public.tenant_module_entitlements WHERE tenant_id = $1",
    [LEGACY_BEMI_TENANT_ID],
  );

  if (await hasTable("tenant_platform_settings")) {
    await client.query(
      `UPDATE public.tenant_platform_settings AS old_settings
          SET tenant_id = $1
        WHERE old_settings.tenant_id = $2
          AND NOT EXISTS (
            SELECT 1 FROM public.tenant_platform_settings AS current_settings
             WHERE current_settings.tenant_id = $1
          )`,
      [CANONICAL_TENANT_ID, LEGACY_BEMI_TENANT_ID],
    );
    await client.query(
      "DELETE FROM public.tenant_platform_settings WHERE tenant_id = $1",
      [LEGACY_BEMI_TENANT_ID],
    );
  }

  if (await hasTable("tenant_database_bindings")) {
    await client.query(
      `UPDATE public.tenant_database_bindings AS old_binding
          SET tenant_id = $1
        WHERE old_binding.tenant_id = $2
          AND NOT EXISTS (
            SELECT 1 FROM public.tenant_database_bindings AS current_binding
             WHERE current_binding.tenant_id = $1
          )`,
      [CANONICAL_TENANT_ID, LEGACY_BEMI_TENANT_ID],
    );
    await client.query(
      "DELETE FROM public.tenant_database_bindings WHERE tenant_id = $1",
      [LEGACY_BEMI_TENANT_ID],
    );
  }

  const legacyAuthOrgResult = await client.query(
    "SELECT auth_organization_id FROM public.tenants WHERE id = $1",
    [LEGACY_BEMI_TENANT_ID],
  );
  await client.query(
    `UPDATE public.tenants
        SET auth_organization_id = COALESCE(auth_organization_id, $2),
            updated_at = now()
      WHERE id = $1`,
    [CANONICAL_TENANT_ID, legacyAuthOrgResult.rows[0]?.auth_organization_id ?? null],
  );
  await client.query(
    `UPDATE public.tenants
        SET auth_organization_id = NULL,
            status = 'closed',
            closed_at = COALESCE(closed_at, now()),
            updated_at = now()
      WHERE id = $1`,
    [LEGACY_BEMI_TENANT_ID],
  );
}

async function main() {
  await client.connect();
  await client.query(apply ? "BEGIN" : "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  // RLS policies use this setting to expose only the legacy tenant's rows to
  // the preflight. Disabling row security would make restricted roles fail.
  await client.query("SELECT set_config('app.tenant_id', $1, true)", [LEGACY_BEMI_TENANT_ID]);

  const report = await preflight();
  console.log(`BMI canonical tenant: ${report.canonical?.slug ?? "missing"} (${CANONICAL_TENANT_ID})`);
  console.log(`BEMI legacy tenant: ${report.legacy?.slug ?? "missing"} (${LEGACY_BEMI_TENANT_ID})`);
  if (report.domainSummary) {
    console.log(`BMI active and verified domains: ${report.domainSummary.activeVerified}/${report.domainSummary.total}`);
  }
  if (report.noOp) {
    console.log(report.legacy
      ? "Legacy BEMI tenant is already closed with no remaining tenant-scoped rows."
      : "No legacy BEMI tenant row exists; no consolidation is needed.");
  } else {
    for (const [tableName, count] of report.tableCounts) {
      console.log(`Legacy ${tableName} rows: ${count}`);
    }
  }

  if (report.blockers.length > 0) {
    console.error("Consolidation stopped:");
    for (const blocker of report.blockers) console.error(`- ${blocker}`);
    await client.query("ROLLBACK");
    process.exitCode = 1;
    return;
  }

  if (report.noOp) {
    await client.query("ROLLBACK");
    console.log("No changes required.");
    return;
  }

  if (!apply) {
    await client.query("ROLLBACK");
    console.log("Preflight is clear. Re-run with --apply to commit consolidation.");
    return;
  }

  await applyConsolidation();
  await client.query("COMMIT");
  console.log("Consolidated BEMI domains and safe registry settings under BMI; closed the legacy BEMI tenant row.");
}

try {
  await main();
} catch (error) {
  try {
    await client.query("ROLLBACK");
  } catch {
    // The connection may not have an active transaction.
  }
  const message = error instanceof Error ? error.message : String(error);
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  const detail = error && typeof error === "object" && "detail" in error ? error.detail : undefined;
  console.error(`BMI/BEMI consolidation failed: ${message || "unknown database or runtime error"}`);
  if (code || detail) console.error(JSON.stringify({ code, detail }));
  if (error instanceof Error && error.stack) console.error(error.stack);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
