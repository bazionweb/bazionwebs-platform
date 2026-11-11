import { createHash } from "node:crypto";
import type { ProvisionProductRequestV1 } from "@bazion/api-contracts";

/** Produce deterministic canonical JSON with recursively sorted keys and omitted undefined fields. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item === undefined ? null : item)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort().filter((key) => record[key] !== undefined);
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
}

/** Hash canonical text into a lowercase 64-char SHA-256 hex digest. */
export function computeSha256Hex(raw: string | Buffer): string {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Fingerprint immutable commercial provisioning semantics so duplicate deliveries
 * are recognized while changed payloads on the same idempotency key are rejected (409).
 */
export function computeProvisioningRequestFingerprint(request: ProvisionProductRequestV1): string {
  const semanticEnvelope = {
    schemaVersion: request.schemaVersion,
    source: request.source,
    // Contact and display fields are not provisioning semantics. Excluding them
    // keeps the persisted digest from becoming a guessable hash of PII.
    customer: { externalCustomerId: request.customer.externalCustomerId },
    order: request.order,
    composition: request.composition,
    requestedDomain: request.requestedDomain ?? null,
  };
  return computeSha256Hex(canonicalJson(semanticEnvelope));
}
