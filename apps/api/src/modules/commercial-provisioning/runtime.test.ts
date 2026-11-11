import { describe, expect, it } from "vitest";
import { createCommercialProvisioningRuntime } from "./runtime.js";

describe("commercial provisioning runtime gate", () => {
  it("does not start the receiver until it is explicitly enabled", () => {
    expect(createCommercialProvisioningRuntime({
      enabled: false,
      databaseUrl: "postgres://bazion_product_provisioner:test@localhost:5432/bazion_platform",
      commandSecret: "a-long-enough-commercial-provisioning-secret",
      commandIssuer: "bazionweb",
      commandAudience: "bazion-platform:commercial-provisioning",
    })).toBeNull();
  });

  it("fails closed when the enable flag is true but credentials are missing", () => {
    expect(createCommercialProvisioningRuntime({
      enabled: true,
      commandIssuer: "bazionweb",
      commandAudience: "bazion-platform:commercial-provisioning",
    })).toBeNull();
  });

  it("creates a runtime only when explicitly enabled and fully configured", async () => {
    const runtime = createCommercialProvisioningRuntime({
      enabled: true,
      databaseUrl: "postgres://bazion_product_provisioner:test@localhost:5432/bazion_platform",
      commandSecret: "a-long-enough-commercial-provisioning-secret",
      commandIssuer: "bazionweb",
      commandAudience: "bazion-platform:commercial-provisioning",
    });

    expect(runtime).not.toBeNull();
    await runtime?.close();
  });
});
