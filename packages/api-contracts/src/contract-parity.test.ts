import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { z } from "zod";
import {
  CONTRACT_COMPATIBILITY_V1,
  evaluateContractVersionCompatibility,
  getInstallationChangeCommandV1JsonSchema,
  getProvisionProductRequestV1JsonSchema,
  getProvisioningOfferCatalogV1JsonSchema,
  getProvisioningOperationV1JsonSchema,
  getProvisioningStatusEventV1JsonSchema,
  getSubscriptionLifecycleCommandV1JsonSchema,
  getSubscriptionLifecycleStatusEventV1JsonSchema,
  installationChangeCommandV1Schema,
  provisionProductRequestV1Schema,
  provisioningOfferCatalogV1Schema,
  provisioningOperationV1Schema,
  provisioningStatusEventV1Schema,
  subscriptionLifecycleCommandV1Schema,
  subscriptionLifecycleStatusEventV1Schema,
} from "./index.js";

interface FixtureSection {
  valid: Array<{ name: string; payload: unknown }>;
  invalid: Array<{ name: string; payload: unknown }>;
}

interface ContractFixtureCorpus {
  schemaVersion: string;
  provisionProductRequest: FixtureSection;
  provisioningOfferCatalog: FixtureSection;
  provisioningOperation: FixtureSection;
  provisioningStatusEvent: FixtureSection;
  subscriptionLifecycleCommand: FixtureSection;
  subscriptionLifecycleStatusEvent: FixtureSection;
  installationChangeCommand: FixtureSection;
}

const fixtures = JSON.parse(
  readFileSync(new URL("../contracts/fixtures/v1-contract-fixtures.json", import.meta.url), "utf8"),
) as ContractFixtureCorpus;

function readSchemaArtifact(fileName: string) {
  return JSON.parse(
    readFileSync(new URL(`../contracts/${fileName}`, import.meta.url), "utf8"),
  ) as Record<string, unknown>;
}

describe("Commercial <-> Platform Contract v1 parity & compatibility", () => {
  it("keeps all 7 published JSON Schema artifacts synchronized with runtime schema builders", () => {
    const schemaPairs: ReadonlyArray<[string, unknown]> = [
      ["provision-product-request-v1.schema.json", getProvisionProductRequestV1JsonSchema()],
      ["provisioning-offer-catalog-v1.schema.json", getProvisioningOfferCatalogV1JsonSchema()],
      ["provisioning-operation-v1.schema.json", getProvisioningOperationV1JsonSchema()],
      ["provisioning-status-event-v1.schema.json", getProvisioningStatusEventV1JsonSchema()],
      ["subscription-lifecycle-command-v1.schema.json", getSubscriptionLifecycleCommandV1JsonSchema()],
      ["subscription-lifecycle-status-event-v1.schema.json", getSubscriptionLifecycleStatusEventV1JsonSchema()],
      ["installation-change-command-v1.schema.json", getInstallationChangeCommandV1JsonSchema()],
    ];

    expect(CONTRACT_COMPATIBILITY_V1.contracts.map((item) => item.fileName)).toEqual(
      schemaPairs.map(([fileName]) => fileName),
    );

    for (const [fileName, runtimeSchema] of schemaPairs) {
      expect(readSchemaArtifact(fileName)).toEqual(runtimeSchema);
    }
  });

  it("enforces minimum supported version, deprecation window, and compatibility policy", () => {
    expect(CONTRACT_COMPATIBILITY_V1.currentVersion).toBe("1.0.0");
    expect(CONTRACT_COMPATIBILITY_V1.minimumSupportedVersion).toBe("1.0.0");
    expect(CONTRACT_COMPATIBILITY_V1.deprecationWindowDays).toBe(90);
    expect(CONTRACT_COMPATIBILITY_V1.upgradeIdentificationRule).toEqual({
      orderLineKeyFormat: "<orderId>:line:<index>",
      targetIdentifierField: "installationId",
      compatibilityField: "targetConfigurationSchemaVersion",
      mutatePinnedCompositionInPlace: false,
    });
    expect(CONTRACT_COMPATIBILITY_V1.piiBoundaryPolicy).toEqual({
      transientCustomerFields: ["customer.displayName", "customer.primaryContact"],
      persistedInPlatformDeliveryTables: false,
      redactedInStructuredLogs: true,
      normalizePrimaryContactOnEmission: true,
    });
    expect(CONTRACT_COMPATIBILITY_V1.evolutionRules.unsupportedVersionBehavior).toContain("400");
    expect(subscriptionLifecycleCommandV1Schema.shape).toHaveProperty("installationId");
    expect(subscriptionLifecycleCommandV1Schema.shape).toHaveProperty("targetConfigurationSchemaVersion");
    expect(provisionProductRequestV1Schema.shape).not.toHaveProperty("installationId");
    expect(provisionProductRequestV1Schema.shape).not.toHaveProperty("targetInstallationId");

    expect(evaluateContractVersionCompatibility("1.0.0")).toMatchObject({
      supported: true,
      reason: "supported",
    });
    expect(evaluateContractVersionCompatibility("0.9.0")).toMatchObject({
      supported: false,
      reason: "below_minimum",
    });
    expect(evaluateContractVersionCompatibility("2.0.0")).toMatchObject({
      supported: false,
      reason: "unsupported_major",
    });
    expect(evaluateContractVersionCompatibility("invalid")).toMatchObject({
      supported: false,
      reason: "malformed",
    });
  });

  const sections: ReadonlyArray<{
    key: keyof Omit<ContractFixtureCorpus, "schemaVersion">;
    schema: z.ZodTypeAny;
  }> = [
    { key: "provisionProductRequest", schema: provisionProductRequestV1Schema },
    { key: "provisioningOfferCatalog", schema: provisioningOfferCatalogV1Schema },
    { key: "provisioningOperation", schema: provisioningOperationV1Schema },
    { key: "provisioningStatusEvent", schema: provisioningStatusEventV1Schema },
    { key: "subscriptionLifecycleCommand", schema: subscriptionLifecycleCommandV1Schema },
    { key: "subscriptionLifecycleStatusEvent", schema: subscriptionLifecycleStatusEventV1Schema },
    { key: "installationChangeCommand", schema: installationChangeCommandV1Schema },
  ];

  for (const section of sections) {
    it(`validates all shared positive and negative fixtures for ${section.key}`, () => {
      const group = fixtures[section.key];
      expect(group.valid.length).toBeGreaterThan(0);
      expect(group.invalid.length).toBeGreaterThan(0);

      for (const sample of group.valid) {
        const result = section.schema.safeParse(sample.payload);
        expect(result.success, `Expected valid fixture "${sample.name}" to pass`).toBe(true);
      }

      for (const sample of group.invalid) {
        const result = section.schema.safeParse(sample.payload);
        expect(result.success, `Expected invalid fixture "${sample.name}" to fail`).toBe(false);
      }
    });
  }

  it("verifies shared fixtures reference only real commercial offerings", () => {
    const offeringsJson = JSON.parse(
      readFileSync(new URL("../../../products/commercial-offerings.json", import.meta.url), "utf8"),
    ) as { offerings: Array<{ id: string }> };
    const validOfferIds = new Set(offeringsJson.offerings.map((offer) => offer.id));

    for (const sample of fixtures.provisionProductRequest.valid) {
      const offerId = (sample.payload as { order: { offerId: string } }).order.offerId;
      expect(validOfferIds.has(offerId)).toBe(true);
    }
  });
});

