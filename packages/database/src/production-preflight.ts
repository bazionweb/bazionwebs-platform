import { Pool } from "pg";

type DbPool = InstanceType<typeof Pool>;

const problems: string[] = [];
const warnings: string[] = [];
const requiredValues: Record<string, string> = {};

function fail(message: string): void {
  problems.push(message);
}

function warn(message: string): void {
  warnings.push(message);
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    fail(`Missing required setting ${name}.`);
    return "";
  }
  requiredValues[name] = value;
  return value;
}

function parseUrl(name: string, expectedUser: string): URL | null {
  const value = required(name);
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!["postgres:", "postgresql:"].includes(url.protocol)) {
      fail(`${name} must use the postgres:// or postgresql:// scheme.`);
      return null;
    }
    if (decodeURIComponent(url.username) !== expectedUser) {
      fail(`${name} must connect as ${expectedUser}; received a different role name.`);
    }
    const hostname = url.hostname.toLowerCase().replace(/^\\[|\\]$/g, "");
    const isLoopback = ["localhost", "127.0.0.1", "::1"].includes(hostname);
    const sslMode = (url.searchParams.get("sslmode") ?? "").toLowerCase();
    const sslEnabled = url.searchParams.get("ssl") === "true" ||
      ["require", "verify-ca", "verify-full"].includes(sslMode);
    if (!isLoopback && !sslEnabled) {
      fail(`${name} uses a remote database endpoint without an explicit TLS mode; configure sslmode=require or stronger verification.`);
    }
    if (!url.password || /local_only|change-me|replace-with|password123/i.test(decodeURIComponent(url.password))) {
      fail(`${name} has an empty or development-looking database password.`);
    }
    return url;
  } catch {
    fail(`${name} is not a valid PostgreSQL connection URL.`);
    return null;
  }
}

function requireHttpsUrl(name: string): void {
  const value = required(name);
  if (!value) return;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") fail(`${name} must use HTTPS in production.`);
  } catch {
    fail(`${name} must be a valid URL.`);
  }
}

function requireHttpsOriginList(name: string): void {
  const value = required(name);
  if (!value) return;
  const items = value.split(",").map((item) => item.trim()).filter(Boolean);
  if (items.length === 0) {
    fail(`${name} must contain at least one origin.`);
    return;
  }
  for (const item of items) {
    try {
      const parsed = new URL(item);
      if (parsed.protocol !== "https:") fail(`${name} contains a non-HTTPS origin.`);
    } catch {
      fail(`${name} contains an invalid URL.`);
    }
  }
}

function checkStaticProductionConfig(): Record<string, URL | null> {
  if (process.env.NODE_ENV !== "production") {
    fail("Run this command with NODE_ENV=production.");
  }

  if (process.env.TENANT_RESOLUTION_MODE !== "verified_domain") {
    fail("TENANT_RESOLUTION_MODE must be verified_domain for production.");
  }
  if (process.env.AUTH_REQUIRE_EMAIL_VERIFICATION !== "true") {
    fail("AUTH_REQUIRE_EMAIL_VERIFICATION must be true for production.");
  }
  if (!(process.env.TRUSTED_PROXY_ADDRESSES ?? "").trim()) {
    fail("TRUSTED_PROXY_ADDRESSES must identify the real ingress proxy addresses/CIDRs.");
  }

  requireHttpsUrl("BETTER_AUTH_URL");
  requireHttpsUrl("AUTH_APP_URL");
  requireHttpsUrl("PUBLIC_STOREFRONT_URL");
  requireHttpsOriginList("CORS_ORIGINS");
  requireHttpsOriginList("BETTER_AUTH_TRUSTED_ORIGINS");

  const authSecret = required("BETTER_AUTH_SECRET");
  if (authSecret.length < 32 || /dev-only|ci-only|change-me|replace-with|local-dev/i.test(authSecret)) {
    fail("BETTER_AUTH_SECRET must be a unique production secret, not an example or CI value.");
  }

  const encryptionKeyValue = required("NOTIFICATION_ENCRYPTION_KEY");
  if (encryptionKeyValue) {
    const key = Buffer.from(encryptionKeyValue, "base64");
    const canonicalBase64 = key.toString("base64") === encryptionKeyValue;
    const knownExample = Buffer.from("0123456789abcdef0123456789abcdef", "utf8").toString("base64");
    if (key.byteLength !== 32 || !canonicalBase64 || encryptionKeyValue === knownExample) {
      fail("NOTIFICATION_ENCRYPTION_KEY must be a fresh canonical Base64 encoding of 32 random bytes; the repository example key is forbidden.");
    }
  }

  const paymentProvider = process.env.PAYMENT_PROVIDER ?? "mock";
  if (paymentProvider === "mock") {
    fail("The API currently supports only the mock payment provider, and production startup intentionally blocks mock payments. A real payment adapter and its verified webhook flow are required before production API sign-off.");
  } else {
    fail("The current API configuration has no registered production payment adapter. Do not override the production payment safeguard until a real provider implementation is merged.");
  }

  const smtpHost = required("NOTIFICATION_SMTP_HOST");
  if (smtpHost && ["localhost", "127.0.0.1", "::1"].includes(smtpHost.toLowerCase())) {
    fail("NOTIFICATION_SMTP_HOST points to loopback; configure the production SMTP endpoint.");
  }
  const smtpPort = Number(process.env.NOTIFICATION_SMTP_PORT ?? "587");
  if (!Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65_535) {
    fail("NOTIFICATION_SMTP_PORT must be a valid TCP port.");
  }
  required("NOTIFICATION_EMAIL_FROM");
  const smtpSecure = process.env.NOTIFICATION_SMTP_SECURE === "true";
  const smtpRequireTls = process.env.NOTIFICATION_SMTP_REQUIRE_TLS !== "false";
  if (!smtpSecure && !smtpRequireTls) fail("Production SMTP must use implicit TLS or mandatory STARTTLS.");
  const smtpUser = process.env.NOTIFICATION_SMTP_USER?.trim();
  const smtpPassword = process.env.NOTIFICATION_SMTP_PASSWORD;
  if (Boolean(smtpUser) !== Boolean(smtpPassword)) {
    fail("Configure both NOTIFICATION_SMTP_USER and NOTIFICATION_SMTP_PASSWORD, or neither.");
  }
  if (!smtpUser || !smtpPassword) {
    fail("Production SMTP authentication requires both NOTIFICATION_SMTP_USER and NOTIFICATION_SMTP_PASSWORD.");
  }

  const batchSize = Number(process.env.NOTIFICATION_WORKER_BATCH_SIZE ?? "5");
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 5) {
    fail("NOTIFICATION_WORKER_BATCH_SIZE must be an integer from 1 to 5.");
  }

  return {
    DATABASE_URL: parseUrl("DATABASE_URL", "bazion_app"),
    AUTH_DATABASE_URL: parseUrl("AUTH_DATABASE_URL", "bazion_auth_runtime"),
    TENANT_RESOLVER_DATABASE_URL: parseUrl("TENANT_RESOLVER_DATABASE_URL", "bazion_tenant_resolver"),
    TENANT_PROVISIONER_DATABASE_URL: parseUrl("TENANT_PROVISIONER_DATABASE_URL", "bazion_tenant_provisioner"),
    NOTIFICATION_ENQUEUER_DATABASE_URL: parseUrl("NOTIFICATION_ENQUEUER_DATABASE_URL", "bazion_notification_enqueuer"),
    NOTIFICATION_WORKER_DATABASE_URL: parseUrl("NOTIFICATION_WORKER_DATABASE_URL", "bazion_notification_worker"),
    MIGRATION_DATABASE_URL: parseUrl("MIGRATION_DATABASE_URL", "bazion_migrator"),
    AUTH_MIGRATION_DATABASE_URL: parseUrl("AUTH_MIGRATION_DATABASE_URL", "bazion_migrator"),
  };
}

async function verifyDatabase(urls: Record<string, URL | null>): Promise<void> {
  const connectionNames = Object.keys(urls);
  if (connectionNames.some((name) => !urls[name] || !requiredValues[name])) {
    warn("Database checks are skipped until all required PostgreSQL connection URLs are present and valid.");
    return;
  }

  const pools = new Map<string, DbPool>();
  try {
    for (const [name, url] of Object.entries(urls)) {
      const connectionString = requiredValues[name];
      if (!url || !connectionString) continue;
      const pool = new Pool({
        connectionString,
        max: 1,
        connectionTimeoutMillis: 5_000,
        idleTimeoutMillis: 5_000,
      });
      pools.set(name, pool);
      const identity = await pool.query<{ current_user: string; current_database: string }>(
        "SELECT current_user, current_database()",
      );
      const expectedUser = decodeURIComponent(url.username);
      if (identity.rows[0]?.current_user !== expectedUser) {
        fail(`${name} connected as an unexpected database role.`);
      }
    }

    const migrationPool = pools.get("MIGRATION_DATABASE_URL");
    if (!migrationPool) {
      fail("Migration database connection was not established.");
      return;
    }

    const applied = await migrationPool.query<{ version: string }>(
      "SELECT version FROM public.schema_migrations WHERE version = ANY($1::varchar[])",
      [["0004_notification_runtime_roles.sql", "0005_platform_audit_events.sql"]],
    );
    const versions = new Set(applied.rows.map((row) => row.version));
    for (const migration of ["0004_notification_runtime_roles.sql", "0005_platform_audit_events.sql"]) {
      if (!versions.has(migration)) fail(`Database migration ${migration} has not been applied.`);
    }

    const roleResult = await migrationPool.query<{
      rolname: string;
      rolcanlogin: boolean;
      rolsuper: boolean;
      rolbypassrls: boolean;
      rolcreatedb: boolean;
      rolcreaterole: boolean;
    }>(
      `SELECT rolname, rolcanlogin, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole
         FROM pg_roles
        WHERE rolname = ANY($1::name[])`,
      [[
        "bazion_app",
        "bazion_auth_runtime",
        "bazion_tenant_resolver",
        "bazion_tenant_provisioner",
        "bazion_notification_enqueuer",
        "bazion_notification_worker",
        "bazion_migrator",
      ]],
    );
    const roleMap = new Map(roleResult.rows.map((row) => [row.rolname, row]));
    const runtimeRoles = [
      "bazion_app",
      "bazion_auth_runtime",
      "bazion_tenant_resolver",
      "bazion_tenant_provisioner",
      "bazion_notification_enqueuer",
      "bazion_notification_worker",
    ];
    for (const roleName of [...runtimeRoles, "bazion_migrator"]) {
      const role = roleMap.get(roleName);
      if (!role) {
        fail(`Required PostgreSQL role ${roleName} does not exist.`);
        continue;
      }
      if (!role.rolcanlogin || role.rolsuper || role.rolbypassrls) {
        fail(`PostgreSQL role ${roleName} must be login-enabled and must not be superuser or bypass RLS.`);
      }
      if (runtimeRoles.includes(roleName) && (role.rolcreatedb || role.rolcreaterole)) {
        fail(`Runtime PostgreSQL role ${roleName} must not have CREATEDB or CREATEROLE.`);
      }
    }

    const privilegeResult = await migrationPool.query<{
      enqueuer_insert_tenant: boolean;
      enqueuer_select_id: boolean;
      enqueuer_select_hash: boolean;
      enqueuer_select_idempotency: boolean;
      enqueuer_insert_channel: boolean;
      enqueuer_insert_ciphertext: boolean;
      enqueuer_insert_hash: boolean;
      enqueuer_insert_idempotency: boolean;
      enqueuer_insert_attempts: boolean;
      enqueuer_select_ciphertext: boolean;
      enqueuer_update: boolean;
      enqueuer_delete: boolean;
      worker_select: boolean;
      worker_update: boolean;
      worker_insert: boolean;
      worker_delete: boolean;
      provisioner_select: boolean;
      provisioner_insert: boolean;
      provisioner_update: boolean;
      provisioner_delete: boolean;
      app_outbox_select: boolean;
      app_outbox_insert: boolean;
      app_outbox_update: boolean;
      app_outbox_delete: boolean;
      auth_outbox_select: boolean;
      app_audit_insert: boolean;
      app_audit_select: boolean;
      app_audit_update: boolean;
      app_audit_delete: boolean;
    }>(
      `SELECT
         has_column_privilege('bazion_notification_enqueuer', 'public.notification_outbox', 'tenant_id', 'INSERT') AS enqueuer_insert_tenant,
         has_column_privilege('bazion_notification_enqueuer', 'public.notification_outbox', 'id', 'SELECT') AS enqueuer_select_id,
         has_column_privilege('bazion_notification_enqueuer', 'public.notification_outbox', 'payload_hash', 'SELECT') AS enqueuer_select_hash,
         has_column_privilege('bazion_notification_enqueuer', 'public.notification_outbox', 'idempotency_key', 'SELECT') AS enqueuer_select_idempotency,
         has_column_privilege('bazion_notification_enqueuer', 'public.notification_outbox', 'channel', 'INSERT') AS enqueuer_insert_channel,
         has_column_privilege('bazion_notification_enqueuer', 'public.notification_outbox', 'payload_ciphertext', 'INSERT') AS enqueuer_insert_ciphertext,
         has_column_privilege('bazion_notification_enqueuer', 'public.notification_outbox', 'payload_hash', 'INSERT') AS enqueuer_insert_hash,
         has_column_privilege('bazion_notification_enqueuer', 'public.notification_outbox', 'idempotency_key', 'INSERT') AS enqueuer_insert_idempotency,
         has_column_privilege('bazion_notification_enqueuer', 'public.notification_outbox', 'max_attempts', 'INSERT') AS enqueuer_insert_attempts,
         has_column_privilege('bazion_notification_enqueuer', 'public.notification_outbox', 'payload_ciphertext', 'SELECT') AS enqueuer_select_ciphertext,
         has_table_privilege('bazion_notification_enqueuer', 'public.notification_outbox', 'UPDATE') AS enqueuer_update,
         has_table_privilege('bazion_notification_enqueuer', 'public.notification_outbox', 'DELETE') AS enqueuer_delete,
         has_table_privilege('bazion_notification_worker', 'public.notification_outbox', 'SELECT') AS worker_select,
         has_table_privilege('bazion_notification_worker', 'public.notification_outbox', 'UPDATE') AS worker_update,
         has_table_privilege('bazion_notification_worker', 'public.notification_outbox', 'INSERT') AS worker_insert,
         has_table_privilege('bazion_notification_worker', 'public.notification_outbox', 'DELETE') AS worker_delete,
         has_table_privilege('bazion_tenant_provisioner', 'public.notification_outbox', 'SELECT') AS provisioner_select,
         has_table_privilege('bazion_tenant_provisioner', 'public.notification_outbox', 'INSERT') AS provisioner_insert,
         has_table_privilege('bazion_tenant_provisioner', 'public.notification_outbox', 'UPDATE') AS provisioner_update,
         has_table_privilege('bazion_tenant_provisioner', 'public.notification_outbox', 'DELETE') AS provisioner_delete,
         has_table_privilege('bazion_app', 'public.notification_outbox', 'SELECT') AS app_outbox_select,
         has_table_privilege('bazion_app', 'public.notification_outbox', 'INSERT') AS app_outbox_insert,
         has_table_privilege('bazion_app', 'public.notification_outbox', 'UPDATE') AS app_outbox_update,
         has_table_privilege('bazion_app', 'public.notification_outbox', 'DELETE') AS app_outbox_delete,
         has_table_privilege('bazion_auth_runtime', 'public.notification_outbox', 'SELECT') AS auth_outbox_select,
         has_table_privilege('bazion_app', 'public.platform_audit_events', 'INSERT') AS app_audit_insert,
         has_table_privilege('bazion_app', 'public.platform_audit_events', 'SELECT') AS app_audit_select,
         has_table_privilege('bazion_app', 'public.platform_audit_events', 'UPDATE') AS app_audit_update,
         has_table_privilege('bazion_app', 'public.platform_audit_events', 'DELETE') AS app_audit_delete`,
    );
    const grants = privilegeResult.rows[0];
    if (!grants) {
      fail("Could not inspect runtime database privileges.");
    } else {
      if (!grants.enqueuer_insert_tenant || !grants.enqueuer_insert_channel || !grants.enqueuer_insert_ciphertext ||
          !grants.enqueuer_insert_hash || !grants.enqueuer_insert_idempotency || !grants.enqueuer_insert_attempts ||
          !grants.enqueuer_select_id || !grants.enqueuer_select_hash || !grants.enqueuer_select_idempotency ||
          grants.enqueuer_select_ciphertext || grants.enqueuer_update || grants.enqueuer_delete) {
        fail("Notification enqueue role grants do not match the restricted INSERT/idempotency SELECT policy.");
      }
      if (!grants.worker_select || !grants.worker_update || grants.worker_insert || grants.worker_delete) {
        fail("Notification worker role grants do not match the SELECT/UPDATE-only policy.");
      }
      if (grants.provisioner_select || grants.provisioner_insert || grants.provisioner_update || grants.provisioner_delete) {
        fail("Tenant provisioner still has notification outbox access.");
      }
      if (grants.app_outbox_select || grants.app_outbox_insert || grants.app_outbox_update || grants.app_outbox_delete || grants.auth_outbox_select) fail("The general API and Better Auth runtime roles must not access notification outbox payloads; only the dedicated enqueuer/worker may access their granted columns.");
      if (!grants.app_audit_insert || grants.app_audit_select || grants.app_audit_update || grants.app_audit_delete) {
        fail("Audit event grants must permit API INSERT only; SELECT/UPDATE/DELETE must remain denied.");
      }
    }

    const trigger = await migrationPool.query<{ enabled: string }>(
      `SELECT t.tgenabled AS enabled
         FROM pg_trigger t
        WHERE t.tgrelid = 'public.platform_audit_events'::regclass
          AND t.tgname = 'platform_audit_events_append_only'
          AND NOT t.tgisinternal`,
    );
    if (trigger.rows[0]?.enabled !== "O") {
      fail("The platform audit append-only trigger is missing or not enabled.");
    }

    const tableFlags = await migrationPool.query<{
      outbox_rls: boolean;
      audit_rls: boolean;
      audit_force_rls: boolean;
    }>(
      `SELECT
         (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.notification_outbox'::regclass) AS outbox_rls,
         (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.platform_audit_events'::regclass) AS audit_rls,
         (SELECT relforcerowsecurity FROM pg_class WHERE oid = 'public.platform_audit_events'::regclass) AS audit_force_rls`,
    );
    const flags = tableFlags.rows[0];
    if (!flags) {
      fail("Could not inspect notification/audit table security flags.");
    } else if (flags.outbox_rls || flags.audit_rls || flags.audit_force_rls) {
      fail("Platform infrastructure outbox/audit tables are expected to use their explicit platform-role grants, not tenant RLS.");
    }

    const authPool = pools.get("AUTH_DATABASE_URL");
    if (!authPool) {
      fail("Better Auth runtime database connection was not established.");
    } else {
      const authTables = await authPool.query<{ users: string | null; sessions: string | null }>(
        "SELECT to_regclass('auth.user')::text AS users, to_regclass('auth.session')::text AS sessions",
      );
      if (!authTables.rows[0]?.users || !authTables.rows[0]?.sessions) {
        fail("Better Auth user/session tables are missing from the auth schema.");
      }
    }

    const dbNames = await Promise.all([...pools.entries()].map(async ([name, pool]) => {
      const result = await pool.query<{ database_name: string }>("SELECT current_database() AS database_name");
      return { name, databaseName: result.rows[0]?.database_name };
    }));
    const distinctNames = new Set(dbNames.map((entry) => entry.databaseName));
    if (distinctNames.size > 1) {
      fail("Application, auth, notification and migration URLs point to different database names; verify intentional topology before proceeding.");
    }
  } catch (error) {
    fail(`Database preflight query failed: ${error instanceof Error ? error.message : "Unknown database error"}`);
  } finally {
    await Promise.all([...pools.values()].map((pool) => pool.end()));
  }
}

async function main(): Promise<void> {
  const urls = checkStaticProductionConfig();
  await verifyDatabase(urls);

  for (const warning of warnings) process.stdout.write(`WARN: ${warning}\n`);
  for (const problem of problems) process.stderr.write(`BLOCKER: ${problem}\n`);

  if (problems.length > 0) {
    process.stderr.write(`Production preflight failed with ${problems.length} blocker(s). No secrets were printed.\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write("Production database and static configuration preflight passed. SMTP connectivity is checked by the notifications package preflight.\n");
}

await main();
