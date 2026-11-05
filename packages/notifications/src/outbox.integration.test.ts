import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { createOutboxPayloadCodec, PostgresNotificationOutbox } from "./outbox.js";

const enqueuerUrl = process.env.NOTIFICATION_ENQUEUER_DATABASE_URL;
const workerUrl = process.env.NOTIFICATION_WORKER_DATABASE_URL;
const integrationEnabled = Boolean(enqueuerUrl && workerUrl && process.env.NOTIFICATION_ENCRYPTION_KEY);

describe.skipIf(!integrationEnabled)("Postgres notification outbox roles and recovery", () => {
  let enqueuerPool: Pool | undefined;
  let workerPool: Pool | undefined;
  let enqueuer: PostgresNotificationOutbox | undefined;
  let worker: PostgresNotificationOutbox | undefined;

  beforeAll(() => {
    const codec = createOutboxPayloadCodec(
      Buffer.from(process.env.NOTIFICATION_ENCRYPTION_KEY ?? "", "base64"),
    );
    enqueuerPool = new Pool({ connectionString: enqueuerUrl, max: 2 });
    workerPool = new Pool({ connectionString: workerUrl, max: 4 });
    enqueuer = new PostgresNotificationOutbox(enqueuerPool, codec);
    worker = new PostgresNotificationOutbox(workerPool, codec);
  });

  afterAll(async () => {
    await Promise.all([enqueuerPool?.end(), workerPool?.end()]);
  });

  it("uses narrow enqueue privileges and rejects idempotency-key payload changes", async () => {
    const privileges = await enqueuerPool!.query<{
      can_read_ciphertext: boolean;
      can_delete: boolean;
    }>(
      `SELECT
         has_column_privilege(current_user, 'public.notification_outbox', 'payload_ciphertext', 'SELECT') AS can_read_ciphertext,
         has_table_privilege(current_user, 'public.notification_outbox', 'DELETE') AS can_delete`,
    );
    expect(privileges.rows[0]?.can_read_ciphertext).toBe(false);
    expect(privileges.rows[0]?.can_delete).toBe(false);

    const idempotencyKey = `integration:auth-email:${randomUUID()}`;
    const payload = {
      to: "outbox-test@example.test",
      subject: "Durable outbox integration test",
      template: "test.integration",
      variables: { intro: "This is a test.", url: "https://example.test/one-time-link" },
    };
    const firstId = await enqueuer!.enqueue({ idempotencyKey, channel: "email", payload });
    const duplicateId = await enqueuer!.enqueue({ idempotencyKey, channel: "email", payload });
    expect(duplicateId).toBe(firstId);

    await expect(enqueuer!.enqueue({
      idempotencyKey,
      channel: "email",
      payload: { ...payload, to: "different@example.test" },
    })).rejects.toThrow(/different payload/);
  });

  it("atomically claims, recovers an expired lease after worker restart, and completes delivery", async () => {
    const idempotencyKey = `integration:worker-recovery:${randomUUID()}`;
    const id = await enqueuer!.enqueue({
      idempotencyKey,
      channel: "email",
      maxAttempts: 4,
      payload: {
        to: "worker-recovery@example.test",
        subject: "Worker recovery test",
        template: "test.recovery",
        variables: { intro: "Recovery test", url: "https://example.test/recovery" },
      },
    });

    const [left, right] = await Promise.all([worker!.claimBatch(100), worker!.claimBatch(100)]);
    const matching = [...left, ...right].filter((delivery) => delivery.id === id);
    expect(matching).toHaveLength(1);
    expect(matching[0]?.attempts).toBe(1);

    const ciphertext = await workerPool!.query<{ payload_ciphertext: string }>(
      "SELECT payload_ciphertext FROM public.notification_outbox WHERE id = $1",
      [id],
    );
    expect(ciphertext.rows[0]?.payload_ciphertext).not.toContain("worker-recovery@example.test");

    await workerPool!.query(
      "UPDATE public.notification_outbox SET locked_at = now() - interval '10 minutes' WHERE id = $1",
      [id],
    );
    const recoveredBatch = await worker!.claimBatch(100);
    const recovered = recoveredBatch.find((delivery) => delivery.id === id);
    expect(recovered?.attempts).toBe(2);
    expect(recovered?.payload.to).toBe("worker-recovery@example.test");
    expect(await worker!.markSent(id)).toBe(true);
    expect(await worker!.markSent(id)).toBe(false);
  });
});
