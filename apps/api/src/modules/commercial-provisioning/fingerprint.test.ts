import { describe, expect, it } from "vitest";
import type { ProvisionProductRequestV1 } from "@bazion/api-contracts";
import { canonicalJson, computeProvisioningRequestFingerprint } from "./fingerprint.js";

const request: ProvisionProductRequestV1 = {
  schemaVersion: "1.0.0",
  eventId: "33333333-3333-4333-8333-333333333333",
  correlationId: "22222222-2222-4222-8222-222222222222",
  idempotencyKey: "bazionweb:order:invoice-1:line:0:v1",
  occurredAt: "2026-11-11T20:00:00.000Z",
  source: "bazionweb",
  customer: {
    externalCustomerId: "customer-1",
    displayName: "Acacia Ltd",
    primaryContact: { name: "Grace Wanjiku", email: "grace@acacia.example" },
  },
  order: {
    externalOrderId: "invoice-1:line:0",
    offerId: "website-business",
    offerVersion: "2026.1.0",
  },
  composition: {
    product: { id: "bazion-site", version: "1.0.0" },
    solution: { id: "business-website", version: "1.0.0" },
    template: { id: "node-nextjs", version: "1.0.0" },
  },
};

describe("commercial provisioning request fingerprint", () => {
  it("canonicalizes object key order", () => {
    expect(canonicalJson({ b: 2, a: { y: 1, x: 0 } }))
      .toBe(canonicalJson({ a: { x: 0, y: 1 }, b: 2 }));
  });

  it("does not persist a deterministic digest of contact or display PII", () => {
    const changedContact: ProvisionProductRequestV1 = {
      ...request,
      customer: {
        ...request.customer,
        displayName: "A different display name",
        primaryContact: { name: "Another person", email: "another@example.test" },
      },
    };

    expect(computeProvisioningRequestFingerprint(changedContact))
      .toBe(computeProvisioningRequestFingerprint(request));
  });

  it("changes when the technical composition or external customer identity changes", () => {
    expect(computeProvisioningRequestFingerprint({
      ...request,
      customer: { ...request.customer, externalCustomerId: "customer-2" },
    })).not.toBe(computeProvisioningRequestFingerprint(request));
    expect(computeProvisioningRequestFingerprint({
      ...request,
      composition: { ...request.composition, product: { id: "bazion-shop", version: "1.0.0" } },
    })).not.toBe(computeProvisioningRequestFingerprint(request));
  });
});
