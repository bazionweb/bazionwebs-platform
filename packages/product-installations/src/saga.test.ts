import { describe, expect, it } from "vitest";
import { ProvisioningStepError, runProvisioningSaga, type ProvisioningSagaJournal, type ProvisioningSagaSnapshot, type ProvisioningSagaStep, type ProvisioningSagaStepName, type ProvisioningStepEffect } from "./saga.js";

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
  attempts = new Map<string, number>();

  async load(): Promise<ProvisioningSagaSnapshot> {
    return { status: this.status, completedSteps: [...this.completedSteps], compensatedSteps: [...this.compensatedSteps], failure: this.failure };
  }
  async setStatus(_id: string, status: ProvisioningSagaSnapshot["status"], failure: ProvisioningSagaSnapshot["failure"] = null) {
    this.status = status;
    this.failure = failure;
  }
  async startStep(_id: string, step: ProvisioningSagaStepName) {
    const next = (this.attempts.get(`forward:${step}`) ?? 0) + 1;
    this.attempts.set(`forward:${step}`, next);
    return next;
  }
  async completeStep(_id: string, step: ProvisioningSagaStepName, effect: ProvisioningStepEffect) {
    if (!this.completedSteps.some((item) => item.name === step)) this.completedSteps.push({ name: step, effect });
  }
  async failStep(_id: string, _step: ProvisioningSagaStepName, failure: NonNullable<ProvisioningSagaSnapshot["failure"]>) { this.failure = failure; }
  async startCompensation(_id: string, step: ProvisioningSagaStepName) {
    const next = (this.attempts.get(`compensate:${step}`) ?? 0) + 1;
    this.attempts.set(`compensate:${step}`, next);
    return next;
  }
  async completeCompensation(_id: string, step: ProvisioningSagaStepName) {
    if (!this.compensatedSteps.includes(step)) this.compensatedSteps.push(step);
  }
  async failCompensation(_id: string, _step: ProvisioningSagaStepName, failure: NonNullable<ProvisioningSagaSnapshot["failure"]>) { this.failure = failure; }
}

function step(name: ProvisioningSagaStepName, behavior: {
  execute?: ProvisioningSagaStep["execute"];
  compensate?: ProvisioningSagaStep["compensate"];
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
});
