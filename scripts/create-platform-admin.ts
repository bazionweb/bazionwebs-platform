import { Pool } from "pg";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required; no bootstrap defaults are permitted.`);
  return value;
}

async function main() {
  const email = required("PLATFORM_ADMIN_EMAIL").toLowerCase();
  const confirmation = required("PLATFORM_ADMIN_CONFIRM_EMAIL").toLowerCase();
  if (email !== confirmation) {
    throw new Error("PLATFORM_ADMIN_CONFIRM_EMAIL must exactly match PLATFORM_ADMIN_EMAIL.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("PLATFORM_ADMIN_EMAIL must be a valid email address.");

  const pool = new Pool({ connectionString: required("MIGRATION_DATABASE_URL"), max: 1 });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const userResult = await client.query<{ id: string; email: string; emailVerified: boolean }>(
      `SELECT id, email, "emailVerified"
         FROM auth."user"
        WHERE lower(email) = $1
        FOR UPDATE`,
      [email],
    );
    const user = userResult.rows[0];
    if (!user) throw new Error("Create the operator account through the normal sign-up flow before bootstrapping it.");
    if (!user.emailVerified) throw new Error("The account email must be verified before it can receive a platform role.");

    const existing = await client.query(
      `SELECT 1 FROM public.platform_members
        WHERE user_id = $1 OR lower(email) = $2
        FOR UPDATE`,
      [user.id, email],
    );
    if (existing.rowCount) throw new Error("A platform membership already exists for this account; use the audited role-management workflow.");

    await client.query(
      `INSERT INTO public.platform_members (user_id, email, role, status)
       VALUES ($1, $2, 'platform_owner', 'active')`,
      [user.id, user.email],
    );
    await client.query(
      `INSERT INTO public.platform_audit_events
         (actor_type, actor_id, actor_role, action, resource_type, resource_id, outcome, metadata)
       VALUES ('system', 'platform-bootstrap-cli', 'platform_owner',
               'platform.owner.bootstrapped', 'platform_member', $1, 'succeeded', '{"method":"cli"}'::jsonb)`,
      [user.id],
    );
    await client.query("COMMIT");
    console.log("Verified account linked to the initial platform-owner role. No password was created or changed.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Platform bootstrap failed.");
  process.exitCode = 1;
});
