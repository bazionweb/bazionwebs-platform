import { afterAll, describe, expect, it } from "vitest";
import { Pool } from "pg";

const connectionString = process.env.HOSTING_RECONCILER_DATABASE_URL;
const integration = connectionString ? describe : describe.skip;

integration("hosting reconciler PostgreSQL least-privilege role", () => {
  const pool = new Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 5_000,
    application_name: "bazion-hosting-reconciler-permission-test",
  });

  afterAll(async () => {
    await pool.end();
  });

  it("can inspect and reconcile hosting rows, append events, but cannot provision or access tenant data", async () => {
    const identity = await pool.query<{ current_user: string }>("SELECT current_user");
    expect(identity.rows[0]?.current_user).toBe("bazion_hosting_reconciler");

    await pool.query("SELECT id,tenant_id,provider,provider_resource_id,state,next_reconcile_at FROM public.tenant_hosting_deployments LIMIT 0");
    await pool.query(
      "UPDATE public.tenant_hosting_deployments SET state=state,error_code=error_code," +
      "lease_token=lease_token,lease_expires_at=lease_expires_at,last_deployed_at=last_deployed_at," +
      "updated_at=updated_at,next_reconcile_at=next_reconcile_at,last_inspected_at=last_inspected_at," +
      "reconcile_failure_count=reconcile_failure_count WHERE false",
    );
    await pool.query(
      "INSERT INTO public.tenant_hosting_deployment_events " +
      "(deployment_id,tenant_id,event_type,actor_type,actor_id,metadata) " +
      "SELECT gen_random_uuid(),gen_random_uuid(),'hosting.permission_test','system','test','{}'::jsonb WHERE false",
    );

    await expect(pool.query(
      "UPDATE public.tenant_hosting_deployments SET attempt_count=attempt_count WHERE false",
    )).rejects.toMatchObject({ code: "42501" });
    await expect(pool.query(
      "INSERT INTO public.tenant_hosting_deployments DEFAULT VALUES",
    )).rejects.toMatchObject({ code: "42501" });
    await expect(pool.query(
      "DELETE FROM public.tenant_hosting_deployments WHERE false",
    )).rejects.toMatchObject({ code: "42501" });
    await expect(pool.query(
      "SELECT id FROM public.tenants LIMIT 0",
    )).rejects.toMatchObject({ code: "42501" });
  });
});
