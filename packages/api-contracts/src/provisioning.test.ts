import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  getProvisionProductRequestV1JsonSchema,
  provisionProductRequestV1Schema,
  provisioningOperationV1Schema,
  provisioningStatusEventV1Schema,
} from "./provisioning.js";

const request = {
  schemaVersion: "1.0.0",
  eventId: "76d60c98-a6ee-49fa-ae27-49a6b5920b98",
  correlationId: "ff46ea3a-a4fb-4f08-8b19-a01a7fbd84a9",
  idempotencyKey: "order:order-2026-0042:provision:v1",
  occurredAt: "2026-11-11T08:30:00.000Z",
  source: "bazionweb",
  customer: {
    externalCustomerId: "customer-1008",
    displayName: "Acacia Studio Ltd",
    primaryContact: { name: "Grace Wanjiku", email: "admin@acacia.example.org" },
  },
  order: {
    externalOrderId: "order-2026-0042",
    offerId: "website-launch",
    offerVersion: "1.0.0",
  },
  composition: {
    product: { id: "bazion-site", version: "1.0.0" },
    solution: { id: "business-website", version: "1.0.0" },
    template: { id: "node-nextjs", version: "1.0.0" },
  },
  requestedDomain: "www.acacia.example.org",
};

describe("Bazion commercial-to-platform provisioning contract v1", () => {
  it("parses a valid request with lowercase contact email and hostname", () => {
    const parsed = provisionProductRequestV1Schema.parse(request);
    expect(parsed.customer.primaryContact.email).toBe("admin@acacia.example.org");
    expect(parsed.requestedDomain).toBe("www.acacia.example.org");
  });

  it("keeps the published JSON Schema artifact synchronized with the runtime validator", () => {
    const artifact = JSON.parse(readFileSync(new URL("../contracts/provision-product-request-v1.schema.json", import.meta.url), "utf8"));
    expect(artifact).toEqual(getProvisionProductRequestV1JsonSchema());
  });

  it("rejects unknown fields and unsupported contract versions", () => {
    expect(provisionProductRequestV1Schema.safeParse({ ...request, paid: true }).success).toBe(false);
    expect(provisionProductRequestV1Schema.safeParse({ ...request, schemaVersion: "2.0.0" }).success).toBe(false);
  });

  it("rejects malformed order identifiers, contact email and non-hostname domains", () => {
    expect(provisionProductRequestV1Schema.safeParse({
      ...request,
      order: { ...request.order, externalOrderId: "../../tenant" },
    }).success).toBe(false);
    expect(provisionProductRequestV1Schema.safeParse({
      ...request,
      customer: { ...request.customer, primaryContact: { name: "Admin", email: "not-an-email" } },
    }).success).toBe(false);
    expect(provisionProductRequestV1Schema.safeParse({
      ...request,
      customer: { ...request.customer, primaryContact: { name: "Admin", email: "ADMIN@example.org" } },
    }).success).toBe(false);
    expect(provisionProductRequestV1Schema.safeParse({ ...request, requestedDomain: "https://example.org/path" }).success).toBe(false);
  });

  it("keeps catalog identifier casing identical to the published JSON Schema", () => {
    expect(provisionProductRequestV1Schema.safeParse({
      ...request,
      order: { ...request.order, offerId: "Website-Launch" },
    }).success).toBe(false);
    expect(provisionProductRequestV1Schema.safeParse({
      ...request,
      composition: { ...request.composition, product: { id: "Bazion-Site", version: "1.0.0" } },
    }).success).toBe(false);
  });

  it("requires tenant and installation identifiers before reporting ready", () => {
    const result = provisioningOperationV1Schema.safeParse({
      schemaVersion: "1.0.0",
      operationId: "76d60c98-a6ee-49fa-ae27-49a6b5920b98",
      correlationId: "ff46ea3a-a4fb-4f08-8b19-a01a7fbd84a9",
      externalOrderId: "order-2026-0042",
      status: "ready",
      currentStep: null,
      tenantId: null,
      installationId: null,
      failure: null,
      updatedAt: "2026-11-11T08:30:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("requires a stable failure code and allows explicit compensation states", () => {
    const base = {
      schemaVersion: "1.0.0",
      operationId: "76d60c98-a6ee-49fa-ae27-49a6b5920b98",
      correlationId: "ff46ea3a-a4fb-4f08-8b19-a01a7fbd84a9",
      externalOrderId: "order-2026-0042",
      currentStep: "provision_hosting",
      tenantId: null,
      installationId: null,
      updatedAt: "2026-11-11T08:30:00.000Z",
    };
    expect(provisioningOperationV1Schema.safeParse({ ...base, status: "failed", failure: null }).success).toBe(false);
    expect(provisioningOperationV1Schema.safeParse({ ...base, status: "compensation_required", failure: null }).success).toBe(false);
    expect(provisioningOperationV1Schema.safeParse({ ...base, status: "compensation_required", failure: { code: "CLEANUP_FAILED", retryable: false } }).success).toBe(true);
    expect(provisioningOperationV1Schema.safeParse({ ...base, status: "compensating", failure: null }).success).toBe(true);
    expect(provisioningOperationV1Schema.safeParse({ ...base, status: "compensated", failure: null }).success).toBe(true);
  });

  it("validates versioned status events and their correlated operation", () => {
    const event = {
      schemaVersion: "1.0.0",
      eventType: "product.provisioning.status.v1",
      eventId: "76d60c98-a6ee-49fa-ae27-49a6b5920b98",
      correlationId: "ff46ea3a-a4fb-4f08-8b19-a01a7fbd84a9",
      occurredAt: "2026-11-11T08:30:00.000Z",
      source: "bazion-platform",
      operation: {
        schemaVersion: "1.0.0",
        operationId: "1bcf8d5a-fc01-4a6b-b8c3-0345b1e22b12",
        correlationId: "ff46ea3a-a4fb-4f08-8b19-a01a7fbd84a9",
        externalOrderId: "order-2026-0042",
        status: "ready",
        currentStep: null,
        tenantId: "6b692865-86e6-42b9-934f-94953912a777",
        installationId: "4954ba5a-6c50-4881-a3bc-c43076c7abc8",
        failure: null,
        updatedAt: "2026-11-11T08:30:00.000Z",
      },
    };
    expect(provisioningStatusEventV1Schema.safeParse(event).success).toBe(true);
    expect(provisioningStatusEventV1Schema.safeParse({ ...event, source: "bazionweb" }).success).toBe(false);
    expect(provisioningStatusEventV1Schema.safeParse({
      ...event,
      operation: { ...event.operation, correlationId: "6b692865-86e6-42b9-934f-94953912a777" },
    }).success).toBe(false);
  });
});
