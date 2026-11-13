import { describe, expect, it } from "vitest";
import type { ProvisionProductRequestV1 } from "@bazion/api-contracts";
import {
  approvedProductionOfferCandidateBindings,
  createProvisioningOfferCatalogV1,
  OfferBindingPromotionError,
  platformProvisioningOfferBindings,
  promoteApprovedProductionOfferBindings,
  ProvisioningOfferResolutionError,
  resolveProvisioningOfferBinding,
  verifyOfferBindingReleaseTrio,
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

  it("blocks production candidate promotion while church-ministry manifests remain partial on disk", () => {
    const verification = verifyOfferBindingReleaseTrio(approvedProductionOfferCandidateBindings[0]!);
    expect(verification.approved).toBe(false);
    expect(verification.blockers).toEqual(
      expect.arrayContaining([
        "PRODUCT_MANIFEST_NOT_STABLE:partial",
        "SOLUTION_MANIFEST_NOT_STABLE:partial",
        "TEMPLATE_MANIFEST_NOT_STABLE:partial",
      ]),
    );
    expect(() => promoteApprovedProductionOfferBindings()).toThrowError(OfferBindingPromotionError);
  });

  it("promotes and pins an audited production binding once all release trio manifests are stable", () => {
    const audits: unknown[] = [];
    const promoted = promoteApprovedProductionOfferBindings(approvedProductionOfferCandidateBindings, {
      snapshot: {
        product: { id: "church-ministry", version: "1.0.0", status: "stable" },
        solution: { id: "church-ministry", version: "1.0.0", status: "stable", readiness: "buildable" },
        template: { id: "church-ministry", version: "1.0.0", status: "stable" },
      },
      auditRecorder: (event) => audits.push(event),
    });

    expect(promoted).toHaveLength(1);
    expect(audits).toHaveLength(1);

    const launchRequest: ProvisionProductRequestV1 = {
      ...request,
      order: { externalOrderId: "order-prod-1", offerId: "website-launch", offerVersion: "1.0.0" },
      composition: {
        product: { id: "church-ministry", version: "1.0.0" },
        solution: { id: "church-ministry", version: "1.0.0" },
        template: { id: "church-ministry", version: "1.0.0" },
      },
    };
    const resolved = resolveProvisioningOfferBinding(launchRequest, promoted);
    expect(resolved.offer).toEqual({ id: "website-launch", version: "1.0.0" });
    expect(resolved.composition.product).toEqual({ id: "church-ministry", version: "1.0.0" });
  });
});
