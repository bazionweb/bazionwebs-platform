import { describe, expect, it } from "vitest";
import {
  commercialPaidOrderSnapshotV1Schema,
  crossEntityReconciliationReportV1Schema,
  cutoverReadinessReportV1Schema,
  provisioningSloSnapshotV1Schema,
  recordOperationalDrillRequestV1Schema,
} from "./operations-cutover.js";

describe("operations and cutover contracts", () => {
  it("validates paid-order snapshots and rejects email PII or secret fields", () => {
    const valid = commercialPaidOrderSnapshotV1Schema.parse({
      externalOrderId: "order-pilot-1",
      externalCustomerId: "cust-pilot-1",
      offerId: "website-launch",
      offerVersion: "1.0.0",
      paymentStatus: "paid",
      paidAt: "2026-11-12T00:00:00.000Z",
      operationId: "11111111-1111-4111-8111-111111111111",
      tenantId: null,
      installationId: null,
      provisioningStatus: "ready",
      legacyFallbackUsed: false,
      legacyTenantId: null,
    });
    expect(valid.externalOrderId).toBe("order-pilot-1");

    expect(
      commercialPaidOrderSnapshotV1Schema.safeParse({
        ...valid,
        externalCustomerId: "alice@example.com",
      }).success,
    ).toBe(false);

    expect(
      commercialPaidOrderSnapshotV1Schema.safeParse({
        ...valid,
        customerEmail: "alice@example.com",
      }).success,
    ).toBe(false);
  });

  it("validates cross-entity reconciliation, SLO snapshot, and cutover readiness contracts", () => {
    const report = crossEntityReconciliationReportV1Schema.parse({
      schemaVersion: "1.0.0",
      generatedAt: "2026-11-12T01:00:00.000Z",
      scope: "cross_repo_five_way",
      correlationId: "22222222-2222-4222-8222-222222222222",
      summary: {
        ordersChecked: 1,
        operationsChecked: 1,
        installationsChecked: 1,
        entitlementsChecked: 3,
        deploymentsChecked: 0,
        totalExceptions: 1,
        criticalExceptions: 1,
        unresolvedDriftCount: 1,
      },
      exceptions: [
        {
          id: "compensation_required:op-1",
          mismatchType: "compensation_required_pending",
          severity: "critical",
          owner: "platform_ops",
          ageSeconds: 420,
          detectedAt: "2026-11-12T01:00:00.000Z",
          entityRefs: {
            externalOrderId: "order-pilot-1",
            operationId: "11111111-1111-4111-8111-111111111111",
          },
          summary: "Provisioning operation requires operator verification and compensation.",
          recommendedAction: "Inspect external provider refs and run manual review or compensation.",
        },
      ],
    });
    expect(report.exceptions[0]?.owner).toBe("platform_ops");

    const slo = provisioningSloSnapshotV1Schema.parse({
      schemaVersion: "1.0.0",
      generatedAt: "2026-11-12T01:00:00.000Z",
      status: "critical",
      metrics: {
        commandAcceptanceCount: 10,
        commandAcceptanceSuccessRate: 1,
        commandAcceptanceP95Ms: 45,
        provisionReadyCount: 8,
        provisionReadyP95Seconds: 18,
        provisionReadyMaxSeconds: 25,
        callbackPendingCount: 1,
        callbackOverdueCount: 0,
        callbackMaxLagSeconds: 4,
        deadLetterCount: 0,
        deadLetterMaxAgeSeconds: 0,
        activeOperationLeaseCount: 0,
        maxOperationLeaseAgeSeconds: 0,
        compensationRequiredCount: 1,
        reconciliationDriftCount: 1,
      },
      thresholds: {
        commandAcceptanceSuccessRateMin: 0.99,
        commandAcceptanceP95MsMax: 1500,
        provisionReadyP95SecondsMax: 300,
        callbackMaxLagSecondsMax: 120,
        deadLetterCountMax: 0,
        deadLetterMaxAgeSecondsMax: 300,
        operationLeaseAgeSecondsMax: 180,
        compensationRequiredCountMax: 0,
        reconciliationDriftCountMax: 0,
      },
      alerts: [
        {
          id: "compensation_required_backlog",
          metric: "compensationRequiredCount",
          severity: "critical",
          owner: "platform_ops",
          observedValue: 1,
          thresholdValue: 0,
          message: "Operations waiting in compensation_required exceed threshold.",
          runbookSection: "safe-compensation",
        },
      ],
    });
    expect(slo.alerts).toHaveLength(1);

    const cutover = cutoverReadinessReportV1Schema.parse({
      schemaVersion: "1.0.0",
      evaluatedAt: "2026-11-12T01:00:00.000Z",
      pilotPolicy: {
        schemaVersion: "1.0.0",
        pilotMode: "staging_pilot",
        environment: "development",
        productionAllowlistClosed: true,
        hostingMutationsEnabled: false,
        legacyFallbackEnabled: true,
        dualReadReconciliationEnabled: true,
        allowedOffers: [
          { offerId: "website-launch", offerVersion: "1.0.0", distributionMode: "shared-managed" },
        ],
        allowedCustomerIds: [],
      },
      readyForStagingPilot: true,
      readyForCanary: false,
      readyToRemoveLegacyProvisioning: false,
      gates: [
        {
          id: "zero_drift",
          name: "Zero unresolved reconciliation drift",
          passed: false,
          blocking: true,
          owner: "platform_ops",
          detail: "1 unresolved reconciliation exception remains.",
          lastVerifiedAt: null,
        },
      ],
    });
    expect(cutover.readyToRemoveLegacyProvisioning).toBe(false);

    expect(
      recordOperationalDrillRequestV1Schema.safeParse({
        drillType: "archive_restore",
        summary: "Restored 30-day archive snapshot to isolated staging tenant.",
        evidenceRef: "drill-2026-11-12-archive-01",
      }).success,
    ).toBe(true);
  });
});

