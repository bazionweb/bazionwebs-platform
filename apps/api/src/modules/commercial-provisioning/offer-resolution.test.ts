import { describe, expect, it } from "vitest";
import type { ProvisionProductRequestV1 } from "@bazion/api-contracts";
import {
  createProvisioningOfferCatalogV1,
  platformProvisioningOfferBindings,
  ProvisioningOfferResolutionError,
  resolveProvisioningOfferBinding,
  type ProvisioningOfferBinding,
} from "./offer-resolution.js";

const request: ProvisionProductRequestV1 = {
  schemaVersion: "1.0.0",
  eventId: "11111111-1111-4111-8111-111111111111",
  correlationId: "22222222-2222-4222-8222-222222222222",
  idempotencyKey: "bazionweb:order:test:line:0:v1",
  occurredAt: "2026-11-12T08:00:00.000Z",
  source: "bazionweb",
  customer: {
    externalCustomerId: "customer-1",
    displayName: "Acacia Ltd",
    primaryContact: { name: "Grace Wanjiku", email: "grace@example.test" },
  },
  order: { externalOrderId: "order-1", offerId: "website-business", offerVersion: "2026.1.0" },
  composition: {
    product: { id: "bazion-site", version: "1.0.0" },
    solution: { id: "business-website", version: "1.0.0" },
    template: { id: "node-nextjs", version: "1.0.0" },
  },
};

const binding: ProvisioningOfferBinding = {
  offer: { id: "website-business", version: "2026.1.0" },
  composition: {
    product: { id: "bazion-site", version: "1.0.0" },
    solution: { id: "business-website", version: "1.0.0" },
    template: { id: "node-nextjs", version: "1.0.0" },
  },
  requiredModules: [{ id: "website-content", version: "1.0.0" }],
  optionalModules: [{ id: "analytics", version: "1.0.0" }],
  distributionMode: "shared-managed",
  availability: "active",
  releaseState: {
    product: "stable",
    solution: "stable",
    solutionReadiness: "buildable",
    template: "stable",
  },
};

describe("platform provisioning offer bindings", () => {
  it("keeps the production allowlist closed until stable platform releases are bound", () => {
    expect(platformProvisioningOfferBindings).toEqual([]);
    expect(() => resolveProvisioningOfferBinding(request)).toThrowError(
      new ProvisioningOfferResolutionError("PROVISIONING_OFFER_NOT_BOUND"),
    );
  });

  it("resolves an exact pinned composition and platform-owned module entitlements", () => {
    expect(resolveProvisioningOfferBinding(request, [binding])).toBe(binding);
  });

  it("rejects unknown offer versions and client-selected composition drift", () => {
    expect(() => resolveProvisioningOfferBinding({
      ...request,
      order: { ...request.order, offerVersion: "2025.1.0" },
    }, [binding])).toThrowError(new ProvisioningOfferResolutionError("PROVISIONING_OFFER_VERSION_NOT_BOUND"));

    expect(() => resolveProvisioningOfferBinding({
      ...request,
      composition: { ...request.composition, product: { id: "bazion-shop", version: "9.9.9" } },
    }, [binding])).toThrowError(new ProvisioningOfferResolutionError("PROVISIONING_COMPOSITION_MISMATCH"));
  });

  it("rejects retired, unstable, or dedicated bindings until the secret-manager path is ready", () => {
    expect(() => resolveProvisioningOfferBinding(request, [{ ...binding, availability: "retired" }]))
      .toThrowError(new ProvisioningOfferResolutionError("PROVISIONING_OFFER_RETIRED"));
    expect(() => resolveProvisioningOfferBinding(request, [{
      ...binding,
      releaseState: { ...binding.releaseState, product: "partial" },
    }])).toThrowError(new ProvisioningOfferResolutionError("PROVISIONING_OFFER_RELEASE_UNSTABLE"));
    expect(() => resolveProvisioningOfferBinding(request, [{ ...binding, distributionMode: "dedicated" }]))
      .toThrowError(new ProvisioningOfferResolutionError("PROVISIONING_OFFER_DISTRIBUTION_UNSUPPORTED"));
  });

  it("publishes only active stable shared-managed bindings and keeps the catalog price-free", () => {
    const unstable = {
      ...binding,
      offer: { id: "unstable-offer", version: "1.0.0" },
      releaseState: { ...binding.releaseState, template: "partial" as const },
    };
    const retired = { ...binding, offer: { id: "retired-offer", version: "1.0.0" }, availability: "retired" as const };
    const dedicated = { ...binding, offer: { id: "dedicated-offer", version: "1.0.0" }, distributionMode: "dedicated" as const };
    const catalog = createProvisioningOfferCatalogV1(
      [unstable, retired, dedicated, binding],
      new Date("2026-11-12T00:00:00.000Z"),
    );

    expect(catalog).toMatchObject({
      schemaVersion: "1.0.0",
      generatedAt: "2026-11-12T00:00:00.000Z",
      bindings: [{ offer: binding.offer, composition: binding.composition }],
    });
    expect(JSON.stringify(catalog)).not.toMatch(/price|amount|currency/i);
  });
});
