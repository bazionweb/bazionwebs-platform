import { describe, expect, it } from "vitest";
import {
  provisioningSagaSteps,
  ProvisioningStepError,
  runProvisioningSaga,
  StaleSagaLeaseError,
  type ProvisioningSagaJournal,
  type ProvisioningSagaLease,
  type ProvisioningSagaSnapshot,
  type ProvisioningSagaStep,
  type ProvisioningSagaStepName,
  type ProvisioningStepEffect,
} from "./saga.js";

const context = {
  operationId: "operation-1",
  correlationId: "correlation-1",
  externalOrderId: "order-1",
  tenantId: null,
  installationId: null,
};

class MemoryJournal implements ProvisioningSagaJournal {
  status: ProvisioningSagaSnapshot["status"] = "accepted";
  completedSteps: { name: ProvisioningSagaStepName; effect: ProvisioningStepEffect }[] = [];
  compensatedSteps: ProvisioningSagaStepName[] = [];
  failure: ProvisioningSagaSnapshot["failure"] = null;
  runningStep: NonNullable<ProvisioningSagaSnapshot["runningStep"]> | null = null;
  unknownStep: NonNullable<ProvisioningSagaSnapshot["unknownStep"]> | null = null;
  attempts = new Map<string, number>();
  activeLease: ProvisioningSagaLease | null = null;
  renewCalls = 0;

  private checkLease(lease?: ProvisioningSagaLease) {
    if (lease && this.activeLease && (lease.leaseToken !== this.activeLease.leaseToken || lease.fencingToken !== this.activeLease.fencingToken)) {
      throw new StaleSagaLeaseError(context.operationId, lease.fencingToken);
    }
  }

  async renewLease(input: { operationId: string; lease: ProvisioningSagaLease; leaseDurationMs?: number }) {
    this.renewCalls += 1;
    this.checkLease(input.lease);
  }

  async load(): Promise<ProvisioningSagaSnapshot> {
    return {
      status: this.status,
      completedSteps: [...this.completedSteps],
      compensatedSteps: [...this.compensatedSteps],
      failure: this.failure,
      runningStep: this.runningStep,
      unknownStep: this.unknownStep,
    };
  }
  async setStatus(_id: string, status: ProvisioningSagaSnapshot["status"], failure: ProvisioningSagaSnapshot["failure"] = null, lease?: ProvisioningSagaLease) {
    this.checkLease(lease);
    this.status = status;
    this.failure = failure;
  }
  async startStep(_id: string, step: ProvisioningSagaStepName, lease?: ProvisioningSagaLease) {
    this.checkLease(lease);
    const next = (this.attempts.get(`forward:${step}`) ?? 0) + 1;
    this.attempts.set(`forward:${step}`, next);
    this.runningStep = { name: step, direction: "forward", attemptNumber: next, fencingToken: lease?.fencingToken ?? 0 };
    return next;
  }
  async completeStep(_id: string, step: ProvisioningSagaStepName, effect: ProvisioningStepEffect, lease?: ProvisioningSagaLease) {
    this.checkLease(lease);
    if (!this.completedSteps.some((item) => item.name === step)) this.completedSteps.push({ name: step, effect });
    if (this.runningStep?.name === step) this.runningStep = null;
    if (this.unknownStep?.name === step) this.unknownStep = null;
  }
  async failStep(_id: string, step: ProvisioningSagaStepName, failure: NonNullable<ProvisioningSagaSnapshot["failure"]>, lease?: ProvisioningSagaLease) {
    this.checkLease(lease);
    this.failure = failure;
    if (this.runningStep?.name === step) this.runningStep = null;
    if (failure.disposition === "unknown") {
      this.unknownStep = { name: step, direction: "forward", attemptNumber: this.attempts.get(`forward:${step}`) ?? 1, errorCode: failure.code };
    }
  }
  async startCompensation(_id: string, step: ProvisioningSagaStepName, lease?: ProvisioningSagaLease) {
    this.checkLease(lease);
    const next = (this.attempts.get(`compensate:${step}`) ?? 0) + 1;
    this.attempts.set(`compensate:${step}`, next);
    return next;
  }
  async completeCompensation(_id: string, step: ProvisioningSagaStepName, lease?: ProvisioningSagaLease) {
    this.checkLease(lease);
    if (!this.compensatedSteps.includes(step)) this.compensatedSteps.push(step);
  }
  async failCompensation(_id: string, _step: ProvisioningSagaStepName, failure: NonNullable<ProvisioningSagaSnapshot["failure"]>, lease?: ProvisioningSagaLease) {
    this.checkLease(lease);
    this.failure = failure;
  }
}

function step(name: ProvisioningSagaStepName, behavior: {
  inspect?: ProvisioningSagaStep["inspect"] | undefined;
  execute?: ProvisioningSagaStep["execute"] | undefined;
  compensate?: ProvisioningSagaStep["compensate"] | undefined;
} = {}): ProvisioningSagaStep {
  const statuses: Record<ProvisioningSagaStepName, ProvisioningSagaStep["status"]> = {
    validate_composition: "validating",
    ensure_tenant: "provisioning_tenant",
    create_installation: "configuring_installation",
    configure_installation: "configuring_installation",
    bind_domain: "configuring_installation",
    provision_hosting: "provisioning_hosting",
    verify_readiness: "provisioning_hosting",
  };
  return {
    name,
    status: statuses[name],
    ...(behavior.inspect ? { inspect: behavior.inspect } : {}),
    execute: behavior.execute ?? (async () => ({ resource_ref: `${name}-resource` })),
    compensate: behavior.compensate ?? (async () => undefined),
  };
}

describe("durable provisioning saga orchestration", () => {
  it("runs forward steps in order with stable step idempotency keys", async () => {
    const journal = new MemoryJournal();
    const calls: string[] = [];
    const steps = [
      step("ensure_tenant", { execute: async (_ctx, key) => { calls.push(key); return { tenant_ref: "tenant-1" }; } }),
      step("create_installation", { execute: async (_ctx, key) => { calls.push(key); return { installation_ref: "install-1" }; } }),
      step("provision_hosting", { execute: async (_ctx, key) => { calls.push(key); return { deployment_ref: "deployment-1" }; } }),
    ];

    await expect(runProvisioningSaga({ context, steps, journal })).resolves.toEqual({ status: "ready", failure: null });
    expect(calls).toEqual([
      "operation-1:ensure_tenant:forward",
      "operation-1:create_installation:forward",
      "operation-1:provision_hosting:forward",
    ]);
    expect(journal.completedSteps.map((item) => item.name)).toEqual(["ensure_tenant", "create_installation", "provision_hosting"]);
  });

  it("resumes after a retryable failure without repeating completed effects", async () => {
    const journal = new MemoryJournal();
    let hostingAttempts = 0;
    const tenant = step("ensure_tenant");
    const hosting = step("provision_hosting", {
      execute: async () => {
        hostingAttempts += 1;
        if (hostingAttempts === 1) throw new ProvisioningStepError("HOSTING_TIMEOUT", "retry");
        return { deployment_ref: "deployment-1" };
      },
    });

    await expect(runProvisioningSaga({ context, steps: [tenant, hosting], journal })).resolves.toMatchObject({ status: "failed", failure: { retryable: true } });
    await expect(runProvisioningSaga({ context, steps: [tenant, hosting], journal })).resolves.toEqual({ status: "ready", failure: null });
    expect(journal.attempts.get("forward:ensure_tenant")).toBe(1);
    expect(journal.attempts.get("forward:provision_hosting")).toBe(2);
  });

  it("compensates completed work in reverse order after a terminal failure", async () => {
    const journal = new MemoryJournal();
    const compensated: string[] = [];
    const steps = [
      step("ensure_tenant", { compensate: async () => { compensated.push("tenant"); } }),
      step("create_installation", { compensate: async () => { compensated.push("installation"); } }),
      step("provision_hosting", { execute: async () => { throw new ProvisioningStepError("INVALID_DEPLOYMENT", "compensate"); } }),
    ];

    await expect(runProvisioningSaga({ context, steps, journal })).resolves.toMatchObject({ status: "compensated" });
    expect(compensated).toEqual(["installation", "tenant"]);
  });

  it("does not compensate blindly when a failed forward step has an unknown external outcome", async () => {
    const journal = new MemoryJournal();
    let compensated = false;
    const steps = [
      step("ensure_tenant", { compensate: async () => { compensated = true; } }),
      step("provision_hosting", { execute: async () => { throw new Error("provider timed out after accepting"); } }),
    ];

    await expect(runProvisioningSaga({ context, steps, journal })).resolves.toMatchObject({ status: "compensation_required", failure: { code: "UNKNOWN_STEP_OUTCOME" } });
    expect(compensated).toBe(false);
  });

  it("requires an explicit recovery attempt when a compensation fails", async () => {
    const journal = new MemoryJournal();
    let failCompensation = true;
    const tenant = step("ensure_tenant", {
      compensate: async () => {
        if (failCompensation) throw new Error("temporary cleanup failure");
      },
    });
    const deployment = step("provision_hosting", { execute: async () => { throw new ProvisioningStepError("INVALID_DEPLOYMENT", "compensate"); } });
    const steps = [tenant, deployment];

    await expect(runProvisioningSaga({ context, steps, journal })).resolves.toMatchObject({ status: "compensation_required", failure: { code: "COMPENSATION_FAILED" } });
    await expect(runProvisioningSaga({ context, steps, journal })).resolves.toMatchObject({ status: "compensation_required" });
    failCompensation = false;
    await expect(runProvisioningSaga({ context, steps, journal, resumeCompensation: true })).resolves.toEqual({ status: "compensated", failure: null });
    expect(journal.attempts.get("compensate:ensure_tenant")).toBe(2);
  });

  it("returns a ready result without repeating effects on duplicate delivery", async () => {
    const journal = new MemoryJournal();
    const onlyStep = step("ensure_tenant");
    await runProvisioningSaga({ context, steps: [onlyStep], journal });
    await runProvisioningSaga({ context, steps: [onlyStep], journal });
    expect(journal.attempts.get("forward:ensure_tenant")).toBe(1);
  });

  it("rejects unordered saga definitions and secret-shaped step references", async () => {
    const journal = new MemoryJournal();
    await expect(runProvisioningSaga({
      context,
      steps: [step("provision_hosting"), step("ensure_tenant")],
      journal,
    })).rejects.toThrow("INVALID_PROVISIONING_SAGA_STEPS");

    await expect(runProvisioningSaga({
      context,
      steps: [step("ensure_tenant", { execute: async () => ({ access_token: "must-not-persist" }) })],
      journal,
    })).resolves.toMatchObject({ status: "compensation_required", failure: { code: "UNSAFE_EFFECT_REFERENCE" } });
    expect(journal.completedSteps).toHaveLength(0);
  });

  it("injects terminal failures across every one of all 7 steps and compensates strictly in reverse order", async () => {
    for (const failingStep of provisioningSagaSteps) {
      const journal = new MemoryJournal();
      const compensated: string[] = [];
      const steps = provisioningSagaSteps.map((name) =>
        step(name, {
          execute: async () => {
            if (name === failingStep) throw new ProvisioningStepError("INJECTED_TERMINAL_FAILURE", "compensate");
            return { resource_ref: `${name}-ref` };
          },
          compensate: async () => {
            compensated.push(name);
          },
        }),
      );

      const result = await runProvisioningSaga({ context, steps, journal });
      expect(result.status).toBe("compensated");
      const failingIndex = provisioningSagaSteps.indexOf(failingStep);
      const expectedReverse = provisioningSagaSteps.slice(0, failingIndex).reverse();
      expect(compensated).toEqual(expectedReverse);
    }
  });

  it("inspects external state after crash-before-commit and rejects stale workers with fencing errors", async () => {
    const journal = new MemoryJournal();
    const staleLease: ProvisioningSagaLease = { leaseToken: "lease-1", fencingToken: 1, workerId: "worker-a" };
    const newLease: ProvisioningSagaLease = { leaseToken: "lease-2", fencingToken: 2, workerId: "worker-b" };
    journal.activeLease = staleLease;

    let hostingCreated = 0;
    let simulatedCrashTriggered = false;
    const crashingSteps: ProvisioningSagaStep[] = [
      step("ensure_tenant", {
        execute: async () => ({ tenant_id: "00000000-0000-4000-8000-000000000001" }),
      }),
      step("provision_hosting", {
        inspect: async () => (hostingCreated > 0 ? { outcome: "completed", effect: { deployment_id: "dep-1" } } : { outcome: "absent" }),
        execute: async () => {
          hostingCreated += 1;
          if (!simulatedCrashTriggered) {
            simulatedCrashTriggered = true;
            // Worker B takes over lease while Worker A stalls right after external creation
            journal.activeLease = newLease;
            return { deployment_id: "dep-1" };
          }
          return { deployment_id: "dep-1" };
        },
      }),
    ];

    // Worker A tries to commit after Worker B took the lease -> must throw StaleSagaLeaseError cleanly
    await expect(
      runProvisioningSaga({ context, steps: crashingSteps, journal, lease: staleLease }),
    ).rejects.toBeInstanceOf(StaleSagaLeaseError);
    expect(hostingCreated).toBe(1);

    // Worker B resumes with fencing token 2 -> sees interrupted `running` attempt, inspects -> skips duplicate execute!
    const recoveryResult = await runProvisioningSaga({
      context,
      steps: crashingSteps,
      journal,
      lease: newLease,
    });
    expect(recoveryResult).toEqual({ status: "ready", failure: null });
    expect(hostingCreated).toBe(1);
  });

  it("inspects unknown step before compensating so completed external side-effects are rolled back too", async () => {
    const journal = new MemoryJournal();
    const compensated: string[] = [];
    let externalCreated = false;
    const steps: ProvisioningSagaStep[] = [
      step("ensure_tenant", { compensate: async () => { compensated.push("ensure_tenant"); } }),
      step("provision_hosting", {
        inspect: async () => (externalCreated ? { outcome: "completed", effect: { deployment_id: "dep-99" } } : { outcome: "absent" }),
        execute: async () => {
          externalCreated = true;
          throw new ProvisioningStepError("TIMEOUT_AFTER_SUBMIT", "unknown");
        },
        compensate: async () => { compensated.push("provision_hosting"); },
      }),
    ];

    const first = await runProvisioningSaga({ context, steps, journal });
    expect(first.status).toBe("compensation_required");
    expect(compensated).toEqual([]);

    const resolved = await runProvisioningSaga({ context, steps, journal, resumeCompensation: true });
    expect(resolved.status).toBe("compensated");
    expect(compensated).toEqual(["provision_hosting", "ensure_tenant"]);
  });

  it("renews leases before each step and halts stale workers before running the next external side effect", async () => {
    const journal = new MemoryJournal();
    const lease1: ProvisioningSagaLease = { leaseToken: "lease-1", fencingToken: 1, workerId: "worker-a" };
    const lease2: ProvisioningSagaLease = { leaseToken: "lease-2", fencingToken: 2, workerId: "worker-b" };
    journal.activeLease = lease1;

    let step2Executed = false;
    const originalCompleteStep = journal.completeStep.bind(journal);
    journal.completeStep = async (operationId, stepName, effect, lease) => {
      await originalCompleteStep(operationId, stepName, effect, lease);
      journal.activeLease = lease2;
    };
    const steps: ProvisioningSagaStep[] = [
      step("ensure_tenant", {
        execute: async () => ({ tenant_id: "00000000-0000-4000-8000-000000000001" }),
      }),
      step("create_installation", {
        execute: async () => {
          step2Executed = true;
          return { installation_id: "00000000-0000-4000-8000-000000000002" };
        },
      }),
    ];

    await expect(
      runProvisioningSaga({ context, steps, journal, lease: lease1, leaseDurationMs: 45_000 }),
    ).rejects.toBeInstanceOf(StaleSagaLeaseError);
    expect(step2Executed).toBe(false);
    expect(journal.renewCalls).toBe(2);
  });
});
