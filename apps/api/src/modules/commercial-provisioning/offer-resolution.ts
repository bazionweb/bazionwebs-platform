import type { ProvisionProductRequestV1 } from "@bazion/api-contracts";
import { provisioningOfferCatalogV1Schema, type ProvisioningOfferCatalogV1 } from "@bazion/api-contracts";

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

export type ProvisioningDistributionMode = ProvisioningOfferBinding["distributionMode"];
export const defaultSupportedProvisioningDistributionModes: readonly ProvisioningDistributionMode[] = ["shared-managed"];

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

export interface ResolveProvisioningOfferOptions {
  allowStagingPartialRelease?: boolean;
}

/** Resolve a commercial offer to a platform-approved immutable composition. */
export function resolveProvisioningOfferBinding(
  request: ProvisionProductRequestV1,
  bindings: readonly ProvisioningOfferBinding[] = platformProvisioningOfferBindings,
  supportedDistributionModes: readonly ProvisioningDistributionMode[] = defaultSupportedProvisioningDistributionModes,
  options?: ResolveProvisioningOfferOptions,
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
  const allowPartial = options?.allowStagingPartialRelease === true;
  const releaseValid =
    binding.releaseState.solutionReadiness === "buildable"
    && (
      allowPartial
        ? (binding.releaseState.product === "stable" || binding.releaseState.product === "partial")
          && (binding.releaseState.solution === "stable" || binding.releaseState.solution === "partial")
          && (binding.releaseState.template === "stable" || binding.releaseState.template === "partial")
        : binding.releaseState.product === "stable"
          && binding.releaseState.solution === "stable"
          && binding.releaseState.template === "stable"
    );
  if (!releaseValid) {
    throw new ProvisioningOfferResolutionError("PROVISIONING_OFFER_RELEASE_UNSTABLE");
  }
  if (!supportedDistributionModes.includes(binding.distributionMode)) {
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

/** Build the public catalog view from active stable shared-managed bindings only. */
export function createProvisioningOfferCatalogV1(
  sourceBindings: readonly ProvisioningOfferBinding[],
  generatedAt = new Date(),
): ProvisioningOfferCatalogV1 {
  const bindings = sourceBindings
    .filter((binding) => binding.availability === "active")
    .filter((binding) => binding.distributionMode === "shared-managed")
    .filter((binding) =>
      binding.releaseState.product === "stable"
      && binding.releaseState.solution === "stable"
      && binding.releaseState.solutionReadiness === "buildable"
      && binding.releaseState.template === "stable",
    )
    .map(({ offer, composition, requiredModules, optionalModules, distributionMode }) => ({
      offer,
      composition,
      requiredModules,
      optionalModules,
      distributionMode,
    }))
    .sort((left, right) =>
      left.offer.id.localeCompare(right.offer.id)
      || left.offer.version.localeCompare(right.offer.version),
    );

  return provisioningOfferCatalogV1Schema.parse({
    schemaVersion: "1.0.0",
    generatedAt: generatedAt.toISOString(),
    bindings,
  });
}

export function getProvisioningOfferCatalogV1(generatedAt = new Date()): ProvisioningOfferCatalogV1 {
  return createProvisioningOfferCatalogV1(platformProvisioningOfferBindings, generatedAt);
}
