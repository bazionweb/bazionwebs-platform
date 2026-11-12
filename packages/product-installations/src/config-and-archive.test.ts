import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createInstallationOffboardingExport,
  planInstallationConfigurationTransform,
  prepareInstallationConfigurationSnapshot,
  serializeInstallationOffboardingExport,
  verifyInstallationOffboardingExport,
} from "./config-and-archive.js";

describe("installation configuration transforms and 30-day archive export envelopes", () => {
  const tenantId = randomUUID();
  const installationId = randomUUID();

  it("plans immutable forward-only configuration upgrades and rejects backwards/secret transforms", () => {
    const plan = planInstallationConfigurationTransform({
      tenantId,
      installationId,
      currentSchemaVersion: "1.0.0",
      targetSchemaVersion: "1.2.0",
      currentConfigurationVersion: 1,
      configuration: { parishName: "St. Jude" },
      createdBy: "operator-1",
      transforms: [
        {
          fromSchemaVersion: "1.0.0",
          toSchemaVersion: "1.1.0",
          validateSource: (s) => ({ ...s }),
          validateTarget: (t) => t as Record<string, unknown>,
          transform: (s) => ({ ...s, enableGiving: true }),
        },
        {
          fromSchemaVersion: "1.1.0",
          toSchemaVersion: "1.2.0",
          validateSource: (s) => ({ ...s }),
          validateTarget: (t) => t as Record<string, unknown>,
          transform: (s) => ({ ...s, theme: "classic" }),
        },
      ],
    });

    expect(plan.snapshots).toHaveLength(2);
    expect(plan.finalSchemaVersion).toBe("1.2.0");
    expect(plan.finalConfigurationVersion).toBe(3);
    expect(plan.finalConfiguration).toEqual({
      parishName: "St. Jude",
      enableGiving: true,
      theme: "classic",
    });

    expect(() =>
      prepareInstallationConfigurationSnapshot({
        tenantId,
        installationId,
        version: 1,
        configurationSchemaVersion: "1.0.0",
        configuration: { dbPassword: "secret" },
        createdBy: "operator-1",
      }),
    ).toThrow();
  });

  it("creates, serializes, and verifies tamper-evident offboarding export envelopes", () => {
    const snap = prepareInstallationConfigurationSnapshot({
      tenantId,
      installationId,
      version: 1,
      configurationSchemaVersion: "1.0.0",
      configuration: { parishName: "Grace Sanctuary" },
      createdBy: "system",
    });

    const envelope = createInstallationOffboardingExport({
      formatVersion: "1.0.0",
      generatedAt: "2026-11-12T04:00:00.000Z",
      installation: {
        id: installationId,
        tenantId,
        productId: "church-ministry",
        productVersion: "1.0.0",
        solutionId: "global-mission",
        solutionVersion: "1.0.0",
        templateId: "church-template",
        templateVersion: "1.0.0",
        configurationSchemaVersion: "1.0.0",
        distributionMode: "shared-managed",
        status: "offboarding",
        currentConfigurationVersion: 1,
        createdBy: "system",
        createdAt: "2026-11-12T03:00:00.000Z",
        readyAt: "2026-11-12T03:05:00.000Z",
        offboardedAt: null,
      },
      configurationVersions: [
        {
          id: randomUUID(),
          createdAt: "2026-11-12T03:04:00.000Z",
          ...snap,
        },
      ],
    });

    const raw = serializeInstallationOffboardingExport(envelope);
    expect(verifyInstallationOffboardingExport(JSON.parse(raw)).checksum).toBe(envelope.checksum);

    expect(() =>
      verifyInstallationOffboardingExport({ ...envelope, checksum: "f".repeat(64) }),
    ).toThrow("checksum does not match");
  });
});

