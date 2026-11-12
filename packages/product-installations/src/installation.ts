export const productInstallationStatuses = [
  "requested",
  "provisioning",
  "ready",
  "suspended",
  "failed",
  "offboarding",
  "offboarded",
] as const;

export type ProductInstallationStatus = typeof productInstallationStatuses[number];

const allowedTransitions: Readonly<Record<ProductInstallationStatus, readonly ProductInstallationStatus[]>> = {
  requested: ["provisioning", "offboarding"],
  provisioning: ["ready", "failed", "offboarding"],
  ready: ["suspended", "offboarding"],
  suspended: ["ready", "offboarding"],
  failed: ["provisioning", "offboarding"],
  offboarding: ["offboarded"],
  offboarded: [],
};

export function canTransitionProductInstallation(
  current: ProductInstallationStatus,
  next: ProductInstallationStatus,
): boolean {
  return current === next || allowedTransitions[current].includes(next);
}

/** Same-state requests are idempotent; all other lifecycle changes must be explicit. */
export function transitionProductInstallation(
  current: ProductInstallationStatus,
  next: ProductInstallationStatus,
): ProductInstallationStatus {
  if (!canTransitionProductInstallation(current, next)) {
    throw new Error(`INVALID_PRODUCT_INSTALLATION_TRANSITION:${current}:${next}`);
  }
  return next;
}

const recoverableStatuses: readonly ProductInstallationStatus[] = [
  "requested",
  "provisioning",
  "ready",
  "suspended",
  "failed",
];

/** Recovers an installation during the 30-day offboarding retention window back to its prior status. */
export function recoverOffboardingInstallation(
  current: ProductInstallationStatus,
  previousStatus: ProductInstallationStatus,
): ProductInstallationStatus {
  if (current !== "offboarding" || !recoverableStatuses.includes(previousStatus)) {
    throw new Error(`INVALID_PRODUCT_INSTALLATION_RECOVERY:${current}:${previousStatus}`);
  }
  return previousStatus;
}
