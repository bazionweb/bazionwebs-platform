import type { ProvisioningOperationStatus } from "@bazion/api-contracts";

export const provisioningSagaSteps = [
  "validate_composition",
  "ensure_tenant",
  "create_installation",
  "configure_installation",
  "bind_domain",
  "provision_hosting",
  "verify_readiness",
] as const;

export type ProvisioningSagaStepName = typeof provisioningSagaSteps[number];
export type ProvisioningStepEffect = Readonly<Record<string, string>>;
export type ProvisioningFailureDisposition = "retry" | "compensate" | "unknown" | "compensation_failed";

export interface ProvisioningSagaContext {
  operationId: string;
  correlationId: string;
  externalOrderId: string;
  tenantId: string | null;
  installationId: string | null;
}

export interface CompletedProvisioningStep {
  name: ProvisioningSagaStepName;
  effect: ProvisioningStepEffect;
}

export interface ProvisioningSagaFailure {
  code: string;
  retryable: boolean;
  disposition: ProvisioningFailureDisposition;
}

export interface ProvisioningSagaSnapshot {
  status: ProvisioningOperationStatus;
  completedSteps: readonly CompletedProvisioningStep[];
  compensatedSteps: readonly ProvisioningSagaStepName[];
  failure: ProvisioningSagaFailure | null;
}

/** The implementation must persist every method and serialize writes per operation ID. */
export interface ProvisioningSagaJournal {
  load(operationId: string): Promise<ProvisioningSagaSnapshot>;
  setStatus(operationId: string, status: ProvisioningOperationStatus, failure?: ProvisioningSagaFailure | null): Promise<void>;
  startStep(operationId: string, step: ProvisioningSagaStepName): Promise<number>;
  completeStep(operationId: string, step: ProvisioningSagaStepName, effect: ProvisioningStepEffect): Promise<void>;
  failStep(operationId: string, step: ProvisioningSagaStepName, failure: ProvisioningSagaFailure): Promise<void>;
  startCompensation(operationId: string, step: ProvisioningSagaStepName): Promise<number>;
  completeCompensation(operationId: string, step: ProvisioningSagaStepName): Promise<void>;
  failCompensation(operationId: string, step: ProvisioningSagaStepName, failure: ProvisioningSagaFailure): Promise<void>;
}

export interface ProvisioningSagaStep {
  name: ProvisioningSagaStepName;
  status: Extract<ProvisioningOperationStatus,
    "validating" | "provisioning_tenant" | "configuring_installation" | "provisioning_hosting">;
  /** Must be idempotent by the supplied key and return references only, never secrets. */
  execute(context: ProvisioningSagaContext, idempotencyKey: string): Promise<ProvisioningStepEffect>;
  /** Must be idempotent by the supplied key and safe to retry after a worker restart. */
  compensate(context: ProvisioningSagaContext, effect: ProvisioningStepEffect, idempotencyKey: string): Promise<void>;
}

export class ProvisioningStepError extends Error {
  readonly code: string;
  readonly disposition: Exclude<ProvisioningFailureDisposition, "compensation_failed">;

  constructor(code: string, disposition: Exclude<ProvisioningFailureDisposition, "compensation_failed">) {
    if (!/^[A-Z][A-Z0-9_]{0,79}$/.test(code)) throw new Error("INVALID_PROVISIONING_FAILURE_CODE");
    super(code);
    this.name = "ProvisioningStepError";
    this.code = code;
    this.disposition = disposition;
  }
}

export type ProvisioningSagaResult = {
  status: "ready" | "failed" | "compensated" | "compensation_required";
  failure: ProvisioningSagaFailure | null;
};

function stepKey(operationId: string, step: ProvisioningSagaStepName, direction: "forward" | "compensate"): string {
  return `${operationId}:${step}:${direction}`;
}

function assertSafeEffect(effect: ProvisioningStepEffect): void {
  const entries = Object.entries(effect);
  if (entries.length > 20 || entries.some(([key, value]) =>
    !/^[a-z][a-z0-9_]{0,63}$/.test(key)
    || /(secret|token|password|credential|dsn|database_url|environment)/i.test(key)
    || typeof value !== "string"
    || value.trim().length === 0
    || value.length > 255
  )) {
    throw new ProvisioningStepError("UNSAFE_EFFECT_REFERENCE", "unknown");
  }
}

function resultFromSnapshot(snapshot: ProvisioningSagaSnapshot): ProvisioningSagaResult {
  const status = snapshot.status;
  if (status === "ready" || status === "compensated" || status === "compensation_required" || status === "failed") {
    return { status, failure: snapshot.failure };
  }
  return { status: "failed", failure: snapshot.failure };
}

async function compensateCompletedSteps(
  context: ProvisioningSagaContext,
  steps: readonly ProvisioningSagaStep[],
  journal: ProvisioningSagaJournal,
): Promise<ProvisioningSagaResult> {
  await journal.setStatus(context.operationId, "compensating");
  const snapshot = await journal.load(context.operationId);
  const stepByName = new Map(steps.map((step) => [step.name, step]));

  for (const completed of [...snapshot.completedSteps].reverse()) {
    if (snapshot.compensatedSteps.includes(completed.name)) continue;
    const step = stepByName.get(completed.name);
    if (!step) {
      const failure = { code: "COMPENSATION_HANDLER_MISSING", retryable: false, disposition: "compensation_failed" as const };
      await journal.setStatus(context.operationId, "compensation_required", failure);
      return { status: "compensation_required", failure };
    }

    await journal.startCompensation(context.operationId, completed.name);
    try {
      await step.compensate(context, completed.effect, stepKey(context.operationId, completed.name, "compensate"));
      await journal.completeCompensation(context.operationId, completed.name);
    } catch {
      const failure = { code: "COMPENSATION_FAILED", retryable: true, disposition: "compensation_failed" as const };
      await journal.failCompensation(context.operationId, completed.name, failure);
      await journal.setStatus(context.operationId, "compensation_required", failure);
      return { status: "compensation_required", failure };
    }
  }

  await journal.setStatus(context.operationId, "compensated", null);
  return { status: "compensated", failure: null };
}

/**
 * Runs an inspectable, journal-backed provisioning saga. Adapters must use the
 * stable per-step idempotency keys because a crash can occur after an external
 * effect succeeds but before its completion is persisted.
 */
export async function runProvisioningSaga(input: {
  context: ProvisioningSagaContext;
  steps: readonly ProvisioningSagaStep[];
  journal: ProvisioningSagaJournal;
  resumeCompensation?: boolean;
}): Promise<ProvisioningSagaResult> {
  const { context, steps, journal } = input;
  if (!context.operationId || !context.correlationId || !context.externalOrderId) throw new Error("INVALID_PROVISIONING_SAGA_CONTEXT");
  const positions = steps.map((step) => provisioningSagaSteps.indexOf(step.name));
  if (!steps.length || new Set(positions).size !== steps.length || positions.some((position, index) => position < 0 || (index > 0 && position <= positions[index - 1]!))) {
    throw new Error("INVALID_PROVISIONING_SAGA_STEPS");
  }

  let snapshot = await journal.load(context.operationId);
  if (snapshot.status === "ready" || snapshot.status === "compensated") return resultFromSnapshot(snapshot);
  if (snapshot.status === "compensation_required") {
    if (input.resumeCompensation && snapshot.failure?.disposition === "compensation_failed") {
      return compensateCompletedSteps(context, steps, journal);
    }
    return resultFromSnapshot(snapshot);
  }
  if (snapshot.status === "compensating") return compensateCompletedSteps(context, steps, journal);
  if (snapshot.status === "failed" && snapshot.failure?.retryable !== true) return resultFromSnapshot(snapshot);

  await journal.setStatus(context.operationId, "validating", null);

  for (const step of steps) {
    snapshot = await journal.load(context.operationId);
    if (snapshot.completedSteps.some((completed) => completed.name === step.name)) continue;

    await journal.setStatus(context.operationId, step.status, null);
    await journal.startStep(context.operationId, step.name);
    try {
      const effect = await step.execute(context, stepKey(context.operationId, step.name, "forward"));
      assertSafeEffect(effect);
      await journal.completeStep(context.operationId, step.name, effect);
    } catch (error) {
      const stepError = error instanceof ProvisioningStepError
        ? error
        : new ProvisioningStepError("UNKNOWN_STEP_OUTCOME", "unknown");
      const failure: ProvisioningSagaFailure = {
        code: stepError.code,
        retryable: stepError.disposition === "retry",
        disposition: stepError.disposition,
      };
      await journal.failStep(context.operationId, step.name, failure);

      if (stepError.disposition === "retry") {
        await journal.setStatus(context.operationId, "failed", failure);
        return { status: "failed", failure };
      }
      if (stepError.disposition === "unknown") {
        await journal.setStatus(context.operationId, "compensation_required", failure);
        return { status: "compensation_required", failure };
      }
      await journal.setStatus(context.operationId, "failed", failure);
      return compensateCompletedSteps(context, steps, journal);
    }
  }

  await journal.setStatus(context.operationId, "ready", null);
  return { status: "ready", failure: null };
}
