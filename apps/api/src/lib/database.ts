import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import * as schema from "@bazion/database";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});
export const db = drizzle(pool, { schema });

export type TenantTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function withTenantTransaction<T>(tenantId: string, callback: (tx: TenantTransaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
    return callback(tx);
  });
}
