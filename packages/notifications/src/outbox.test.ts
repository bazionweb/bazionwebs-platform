import { describe, expect, it } from "vitest";
import { createOutboxPayloadCodec } from "./outbox.js";

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
