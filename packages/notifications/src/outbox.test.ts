import { describe, expect, it, vi } from "vitest";
import { createOutboxPayloadCodec, PostgresNotificationOutbox, type SqlPool } from "./outbox.js";
import { HttpSmsNotificationAdapter, SmtpEmailNotificationAdapter } from "./providers.js";

describe("notification outbox payload encryption", () => {
  const key = new Uint8Array(32).fill(7);

  it("round-trips a payload with authenticated encryption", () => {
    const codec = createOutboxPayloadCodec(key);
    const payload = JSON.stringify({
      to: "client@example.test",
      subject: "Verify your email",
      template: "auth.verify",
      variables: { url: "https://example.test/verify?token=secret" },
    });
    expect(codec.decrypt(codec.encrypt(payload))).toBe(payload);
  });

  it("uses a fresh nonce for every encryption", () => {
    const codec = createOutboxPayloadCodec(key);
    expect(codec.encrypt("same payload")).not.toBe(codec.encrypt("same payload"));
  });

  it("rejects ciphertext modified after encryption", () => {
    const codec = createOutboxPayloadCodec(key);
    const encrypted = codec.encrypt("private content");
    const altered = encrypted.slice(0, -1) + (encrypted.endsWith("A") ? "B" : "A");
    expect(() => codec.decrypt(altered)).toThrow();
  });

  it("rejects encryption keys that are not 32 bytes", () => {
    expect(() => createOutboxPayloadCodec(new Uint8Array(16))).toThrow(/32 bytes/);
  });
});

describe("notification providers, health metrics and retention scrubbing", () => {
  const key = new Uint8Array(32).fill(9);

  it("renders email and SMS notifications and dispatches through adapters", async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: "smtp-1" });
    const emailAdapter = new SmtpEmailNotificationAdapter({ sendMail }, "noreply@bazion.test");
    const emailResult = await emailAdapter.send({
      id: "d-1",
      tenantId: "t-1",
      channel: "email",
      attempts: 1,
      payload: {
        to: "user@example.test",
        subject: "Welcome",
        template: "auth.welcome",
        variables: { intro: "Welcome to Bazion", url: "https://example.test/login" },
      },
    });
    expect(emailResult.providerMessageId).toBe("smtp-1");
    expect(sendMail).toHaveBeenCalledOnce();

    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ messageId: "sms-9" }), { status: 200 }));
    const smsAdapter = new HttpSmsNotificationAdapter({ webhookUrl: "https://sms.example.test/send", fetchImpl: fetchImpl as typeof fetch });
    const smsResult = await smsAdapter.send({
      id: "d-2",
      tenantId: "t-1",
      channel: "sms",
      attempts: 1,
      payload: {
        to: "+254700000001",
        template: "sms.alert",
        variables: { message: "Your verification code is 123456" },
      },
    });
    expect(smsResult.providerMessageId).toBe("sms-9");
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("computes queue health metrics and scrubs expired payloads without DELETE privilege", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            pending_count: 2,
            processing_count: 1,
            dead_letter_count: 3,
            expired_lease_count: 0,
            oldest_pending_seconds: 120,
          },
        ],
        rowCount: 1,
      })
      .mockResolvedValueOnce({ rows: [], rowCount: 4 });

    const outbox = new PostgresNotificationOutbox({ query } as unknown as SqlPool, createOutboxPayloadCodec(key));
    const health = await outbox.getOutboxHealthMetrics();
    expect(health).toEqual({
      pendingCount: 2,
      processingCount: 1,
      deadLetterCount: 3,
      expiredLeaseCount: 0,
      oldestPendingSeconds: 120,
      alertStatus: "degraded",
    });

    const scrubbed = await outbox.purgeExpiredDeliveries(30);
    expect(scrubbed).toBe(4);
    expect(query.mock.calls[1]?.[0]).toContain("UPDATE public.notification_outbox");
  });
});
