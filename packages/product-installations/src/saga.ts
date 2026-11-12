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

export type ProvisioningSagaStepName = (typeof provisioningSagaSteps)[number];
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

export interface ProvisioningSagaLease {
  leaseToken: string;
  fencingToken: number;
  workerId: string;
}

export interface ProvisioningSagaSnapshot {
  status: ProvisioningOperationStatus;
  completedSteps: readonly CompletedProvisioningStep[];
  compensatedSteps: readonly ProvisioningSagaStepName[];
  failure: ProvisioningSagaFailure | null;
  runningStep?: {
    name: ProvisioningSagaStepName;
    direction: "forward" | "compensate";
    attemptNumber: number;
    fencingToken: number;
  } | null;
  unknownStep?: {
    name: ProvisioningSagaStepName;
    direction: "forward" | "compensate";
    attemptNumber: number;
    errorCode: string;
  } | null;
  tenantId?: string | null;
  installationId?: string | null;
  fencingToken?: number;
}

export type ProvisioningStepInspectionResult =
  | { outcome: "completed"; effect: ProvisioningStepEffect }
  | { outcome: "absent" }
  | { outcome: "pending" };

/** Raised when a worker tries to mutate a saga operation with an expired or superseded lease/fence. */
export class StaleSagaLeaseError extends Error {
  readonly code = "SAGA_FENCING_TOKEN_STALE";

  constructor(operationId: string, expectedFence?: number) {
    super(
      expectedFence === undefined
        ? `Provisioning saga lease or fencing token is stale for operation ${operationId}.`
        : `Provisioning saga fencing token ${expectedFence} is stale for operation ${operationId}.`,
    );
    this.name = "StaleSagaLeaseError";
  }
}

/** The implementation must persist every method and serialize writes per operation ID. */
export interface ProvisioningSagaJournal {
  load(operationId: string): Promise<ProvisioningSagaSnapshot>;
  setStatus(
    operationId: string,
    status: ProvisioningOperationStatus,
    failure?: ProvisioningSagaFailure | null,
    lease?: ProvisioningSagaLease,
  ): Promise<void>;
  startStep(
    operationId: string,
    step: ProvisioningSagaStepName,
    lease?: ProvisioningSagaLease,
  ): Promise<number>;
  completeStep(
    operationId: string,
    step: ProvisioningSagaStepName,
    effect: ProvisioningStepEffect,
    lease?: ProvisioningSagaLease,
  ): Promise<void>;
  failStep(
    operationId: string,
    step: ProvisioningSagaStepName,
    failure: ProvisioningSagaFailure,
    lease?: ProvisioningSagaLease,
  ): Promise<void>;
  startCompensation(
    operationId: string,
    step: ProvisioningSagaStepName,
    lease?: ProvisioningSagaLease,
  ): Promise<number>;
  completeCompensation(
    operationId: string,
    step: ProvisioningSagaStepName,
    lease?: ProvisioningSagaLease,
  ): Promise<void>;
  failCompensation(
    operationId: string,
    step: ProvisioningSagaStepName,
    failure: ProvisioningSagaFailure,
    lease?: ProvisioningSagaLease,
  ): Promise<void>;
}

export interface ProvisioningSagaStep {
  name: ProvisioningSagaStepName;
  status: Extract<
    ProvisioningOperationStatus,
    "validating" | "provisioning_tenant" | "configuring_installation" | "provisioning_hosting"
  >;
  /** Inspects external state before retrying or compensating interrupted/unknown steps. */
  inspect?(context: ProvisioningSagaContext, idempotencyKey: string): Promise<ProvisioningStepInspectionResult>;
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

export function stepIdempotencyKey(
  operationId: string,
  step: ProvisioningSagaStepName,
  direction: "forward" | "compensate",
): string {
  return `${operationId}:${step}:${direction}`;
}

export function assertSafeEffect(effect: ProvisioningStepEffect): void {
  const entries = Object.entries(effect);
  if (
    entries.length > 20
    || entries.some(
      ([key, value]) =>
        !/^[a-z][a-z0-9_]{0,63}$/.test(key)
        || /(secret|token|password|credential|dsn|database_url|environment)/i.test(key)
        || typeof value !== "string"
        || value.trim().length === 0
        || value.length > 255,
    )
  ) {
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

function hydrateContextFromSnapshot(
  context: ProvisioningSagaContext,
  snapshot: ProvisioningSagaSnapshot,
): ProvisioningSagaContext {
  const mutable: ProvisioningSagaContext = { ...context };
  if (!mutable.tenantId && snapshot.tenantId) mutable.tenantId = snapshot.tenantId;
  if (!mutable.installationId && snapshot.installationId) mutable.installationId = snapshot.installationId;
  for (const completed of snapshot.completedSteps) {
    if (!mutable.tenantId && completed.effect.tenant_id) mutable.tenantId = completed.effect.tenant_id;
    if (!mutable.installationId && completed.effect.installation_id) {
      mutable.installationId = completed.effect.installation_id;
    }
  }
  return mutable;
}

function propagateEffectToContext(context: ProvisioningSagaContext, effect: ProvisioningStepEffect): void {
  if (!context.tenantId && effect.tenant_id) context.tenantId = effect.tenant_id;
  if (!context.installationId && effect.installation_id) context.installationId = effect.installation_id;
}

async function compensateCompletedSteps(
  context: ProvisioningSagaContext,
  steps: readonly ProvisioningSagaStep[],
  journal: ProvisioningSagaJournal,
  lease?: ProvisioningSagaLease,
): Promise<ProvisioningSagaResult> {
  await journal.setStatus(context.operationId, "compensating", null, lease);
  const snapshot = await journal.load(context.operationId);
  const workingContext = hydrateContextFromSnapshot(context, snapshot);
  const stepByName = new Map(steps.map((step) => [step.name, step]));

  for (const completed of [...snapshot.completedSteps].reverse()) {
    if (snapshot.compensatedSteps.includes(completed.name)) continue;
    const step = stepByName.get(completed.name);
    if (!step) {
      const failure: ProvisioningSagaFailure = {
        code: "COMPENSATION_HANDLER_MISSING",
        retryable: false,
        disposition: "compensation_failed",
      };
      await journal.setStatus(context.operationId, "compensation_required", failure, lease);
      return { status: "compensation_required", failure };
    }

    await journal.startCompensation(context.operationId, completed.name, lease);
    try {
      await step.compensate(
        workingContext,
        completed.effect,
        stepIdempotencyKey(context.operationId, completed.name, "compensate"),
      );
      await journal.completeCompensation(context.operationId, completed.name, lease);
    } catch (error) {
      if (error instanceof StaleSagaLeaseError) throw error;
      const failure: ProvisioningSagaFailure = {
        code: "COMPENSATION_FAILED",
        retryable: true,
        disposition: "compensation_failed",
      };
      await journal.failCompensation(context.operationId, completed.name, failure, lease);
      await journal.setStatus(context.operationId, "compensation_required", failure, lease);
      return { status: "compensation_required", failure };
    }
  }

  await journal.setStatus(context.operationId, "compensated", null, lease);
  return { status: "compensated", failure: null };
}

/**
 * Runs an inspectable, lease-fenced, journal-backed provisioning saga.
 * When recovering from an interrupted (`running`) or `unknown` step and the
 * step implements `inspect`, external provider state is reconciled before
 * retrying forward execution or running compensation.
 */
export async function runProvisioningSaga(input: {
  context: ProvisioningSagaContext;
  steps: readonly ProvisioningSagaStep[];
  journal: ProvisioningSagaJournal;
  lease?: ProvisioningSagaLease;
  resumeCompensation?: boolean;
  resumeForward?: boolean;
}): Promise<ProvisioningSagaResult> {
  const { context, steps, journal, lease } = input;
  if (!context.operationId || !context.correlationId || !context.externalOrderId) {
    throw new Error("INVALID_PROVISIONING_SAGA_CONTEXT");
  }
  const positions = steps.map((step) => provisioningSagaSteps.indexOf(step.name));
  if (
    !steps.length
    || new Set(positions).size !== steps.length
    || positions.some((position, index) => position < 0 || (index > 0 && position <= positions[index - 1]!))
  ) {
    throw new Error("INVALID_PROVISIONING_SAGA_STEPS");
  }

  let snapshot = await journal.load(context.operationId);
  let workingContext = hydrateContextFromSnapshot(context, snapshot);

  if (snapshot.status === "ready" || snapshot.status === "compensated") {
    return resultFromSnapshot(snapshot);
  }

  if (snapshot.status === "compensation_required") {
    if (input.resumeCompensation && snapshot.failure?.disposition === "compensation_failed") {
      return compensateCompletedSteps(workingContext, steps, journal, lease);
    }
    if (input.resumeCompensation && snapshot.failure?.disposition === "unknown") {
      const unknownStepName = snapshot.unknownStep?.name ?? snapshot.runningStep?.name;
      const unknownStep = steps.find((candidate) => candidate.name === unknownStepName);
      if (unknownStep?.inspect) {
        try {
          const inspected = await unknownStep.inspect(
            workingContext,
            stepIdempotencyKey(workingContext.operationId, unknownStep.name, "forward"),
          );
          if (inspected.outcome === "completed") {
            assertSafeEffect(inspected.effect);
            propagateEffectToContext(workingContext, inspected.effect);
            await journal.completeStep(workingContext.operationId, unknownStep.name, inspected.effect, lease);
            return compensateCompletedSteps(workingContext, steps, journal, lease);
          }
          if (inspected.outcome === "absent") {
            return compensateCompletedSteps(workingContext, steps, journal, lease);
          }
        } catch (error) {
          if (error instanceof StaleSagaLeaseError) throw error;
          return resultFromSnapshot(snapshot);
        }
      }
      return resultFromSnapshot(snapshot);
    }
    if (!input.resumeForward) {
      return resultFromSnapshot(snapshot);
    }
  }

  if (snapshot.status === "compensating") {
    return compensateCompletedSteps(workingContext, steps, journal, lease);
  }
  if (snapshot.status === "failed" && !input.resumeForward && snapshot.failure?.retryable !== true) {
    if (input.resumeCompensation) {
      return compensateCompletedSteps(workingContext, steps, journal, lease);
    }
    return resultFromSnapshot(snapshot);
  }

  await journal.setStatus(workingContext.operationId, "validating", null, lease);

  for (const step of steps) {
    snapshot = await journal.load(workingContext.operationId);
    workingContext = hydrateContextFromSnapshot(workingContext, snapshot);
    if (snapshot.completedSteps.some((completed) => completed.name === step.name)) continue;

    const forwardKey = stepIdempotencyKey(workingContext.operationId, step.name, "forward");
    const needsInspection =
      (snapshot.runningStep?.name === step.name && snapshot.runningStep.direction === "forward")
      || (snapshot.unknownStep?.name === step.name && snapshot.unknownStep.direction === "forward");

    if (needsInspection && step.inspect) {
      await journal.setStatus(workingContext.operationId, step.status, null, lease);
      try {
        const inspected = await step.inspect(workingContext, forwardKey);
        if (inspected.outcome === "completed") {
          assertSafeEffect(inspected.effect);
          propagateEffectToContext(workingContext, inspected.effect);
          await journal.completeStep(workingContext.operationId, step.name, inspected.effect, lease);
          continue;
        }
        if (inspected.outcome === "pending") {
          const pendingFailure: ProvisioningSagaFailure = {
            code: "STEP_EXTERNAL_STATE_PENDING",
            retryable: true,
            disposition: "unknown",
          };
          await journal.failStep(workingContext.operationId, step.name, pendingFailure, lease);
          await journal.setStatus(workingContext.operationId, "compensation_required", pendingFailure, lease);
          return { status: "compensation_required", failure: pendingFailure };
        }
        // outcome === "absent" falls through cleanly to normal step execution
      } catch (error) {
        if (error instanceof StaleSagaLeaseError) throw error;
        const unknownFailure: ProvisioningSagaFailure = {
          code: error instanceof ProvisioningStepError ? error.code : "STEP_INSPECTION_FAILED",
          retryable: false,
          disposition: "unknown",
        };
        await journal.failStep(workingContext.operationId, step.name, unknownFailure, lease);
        await journal.setStatus(workingContext.operationId, "compensation_required", unknownFailure, lease);
        return { status: "compensation_required", failure: unknownFailure };
      }
    }

    await journal.setStatus(workingContext.operationId, step.status, null, lease);
    await journal.startStep(workingContext.operationId, step.name, lease);
    try {
      const effect = await step.execute(workingContext, forwardKey);
      assertSafeEffect(effect);
      propagateEffectToContext(workingContext, effect);
      await journal.completeStep(workingContext.operationId, step.name, effect, lease);
    } catch (error) {
      if (error instanceof StaleSagaLeaseError) throw error;
      const stepError =
        error instanceof ProvisioningStepError
          ? error
          : new ProvisioningStepError("UNKNOWN_STEP_OUTCOME", "unknown");
      const failure: ProvisioningSagaFailure = {
        code: stepError.code,
        retryable: stepError.disposition === "retry",
        disposition: stepError.disposition,
      };
      await journal.failStep(workingContext.operationId, step.name, failure, lease);

      if (stepError.disposition === "retry") {
        await journal.setStatus(workingContext.operationId, "failed", failure, lease);
        return { status: "failed", failure };
      }
      if (stepError.disposition === "unknown") {
        await journal.setStatus(workingContext.operationId, "compensation_required", failure, lease);
        return { status: "compensation_required", failure };
      }
      await journal.setStatus(workingContext.operationId, "failed", failure, lease);
      return compensateCompletedSteps(workingContext, steps, journal, lease);
    }
  }

  await journal.setStatus(workingContext.operationId, "ready", null, lease);
  return { status: "ready", failure: null };
}
