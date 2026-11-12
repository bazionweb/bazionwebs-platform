import type { ProvisionProductRequestV1 } from "@bazion/api-contracts";

export interface ProvisioningOfferReleaseReference {
  id: string;
  version: string;
}

export interface ProvisioningOfferBinding {
  offer: ProvisioningOfferReleaseReference;
  composition: {
    product: ProvisioningOfferReleaseReference;
    solution: ProvisioningOfferReleaseReference;
    template: ProvisioningOfferReleaseReference;
  };
  requiredModules: readonly ProvisioningOfferReleaseReference[];
  optionalModules: readonly ProvisioningOfferReleaseReference[];
  distributionMode: "shared-managed" | "dedicated";
  availability: "active" | "retired";
  releaseState: {
    product: "stable" | "partial" | "experimental" | "planned" | "deprecated";
    solution: "stable" | "partial" | "experimental" | "planned" | "deprecated";
    solutionReadiness: "buildable" | "roadmap";
    template: "stable" | "partial" | "experimental" | "planned" | "deprecated";
  };
}

export type ProvisioningOfferResolutionErrorCode =
  | "PROVISIONING_OFFER_NOT_BOUND"
  | "PROVISIONING_OFFER_VERSION_NOT_BOUND"
  | "PROVISIONING_OFFER_RETIRED"
  | "PROVISIONING_OFFER_RELEASE_UNSTABLE"
  | "PROVISIONING_OFFER_DISTRIBUTION_UNSUPPORTED"
  | "PROVISIONING_COMPOSITION_MISMATCH";

export class ProvisioningOfferResolutionError extends Error {
  constructor(public readonly code: ProvisioningOfferResolutionErrorCode) {
    super(code);
    this.name = "ProvisioningOfferResolutionError";
  }
}

/**
 * The platform owns this allowlist. It remains empty until an offer is pinned
 * to stable product, solution, and template releases. Never derive authority
 * from composition pins supplied by Bazionweb.
 */
export const platformProvisioningOfferBindings: readonly ProvisioningOfferBinding[] = [];

function sameRelease(left: ProvisioningOfferReleaseReference, right: ProvisioningOfferReleaseReference): boolean {
  return left.id === right.id && left.version === right.version;
}

/** Resolve a commercial offer to a platform-approved immutable composition. */
export function resolveProvisioningOfferBinding(
  request: ProvisionProductRequestV1,
  bindings: readonly ProvisioningOfferBinding[] = platformProvisioningOfferBindings,
): ProvisioningOfferBinding {
  const offerBindings = bindings.filter((binding) => binding.offer.id === request.order.offerId);
  if (offerBindings.length === 0) {
    throw new ProvisioningOfferResolutionError("PROVISIONING_OFFER_NOT_BOUND");
  }

  const binding = offerBindings.find((candidate) => candidate.offer.version === request.order.offerVersion);
  if (!binding) {
    throw new ProvisioningOfferResolutionError("PROVISIONING_OFFER_VERSION_NOT_BOUND");
  }
  if (binding.availability !== "active") {
    throw new ProvisioningOfferResolutionError("PROVISIONING_OFFER_RETIRED");
  }
  if (
    binding.releaseState.product !== "stable"
    || binding.releaseState.solution !== "stable"
    || binding.releaseState.solutionReadiness !== "buildable"
    || binding.releaseState.template !== "stable"
  ) {
    throw new ProvisioningOfferResolutionError("PROVISIONING_OFFER_RELEASE_UNSTABLE");
  }
  if (binding.distributionMode !== "shared-managed" && binding.distributionMode !== "dedicated") {
    throw new ProvisioningOfferResolutionError("PROVISIONING_OFFER_DISTRIBUTION_UNSUPPORTED");
  }

  const composition = request.composition;
  if (
    !sameRelease(binding.composition.product, composition.product)
    || !sameRelease(binding.composition.solution, composition.solution)
    || !sameRelease(binding.composition.template, composition.template)
  ) {
    throw new ProvisioningOfferResolutionError("PROVISIONING_COMPOSITION_MISMATCH");
  }

  return binding;
}
