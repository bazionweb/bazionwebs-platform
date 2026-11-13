import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { DistributionMode, ProvisionProductRequestV1 } from "@bazion/api-contracts";
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
  distributionMode: DistributionMode;
  availability: "active" | "retired";
  releaseState: {
    product: "stable" | "partial" | "experimental" | "planned" | "deprecated";
    solution: "stable" | "partial" | "experimental" | "planned" | "deprecated";
    solutionReadiness: "buildable" | "roadmap";
    template: "stable" | "partial" | "experimental" | "planned" | "deprecated";
  };
}

export type ProvisioningDistributionMode = DistributionMode;
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

/**
 * Audited candidate production offer binding pinned to the church-ministry release trio.
 * Remains non-authoritative until all three manifests pass release-trio verification (`status: "stable"`).
 */
export const approvedProductionOfferCandidateBindings: readonly ProvisioningOfferBinding[] = [
  {
    offer: { id: "website-launch", version: "1.0.0" },
    composition: {
      product: { id: "church-ministry", version: "1.0.0" },
      solution: { id: "church-ministry", version: "1.0.0" },
      template: { id: "church-ministry", version: "1.0.0" },
    },
    requiredModules: [
      { id: "platform-identity", version: "1.0.0" },
      { id: "church-ministry", version: "1.0.0" },
      { id: "media-storage", version: "1.0.0" },
    ],
    optionalModules: [
      { id: "notifications", version: "0.1.0" },
      { id: "analytics", version: "1.0.0" },
      { id: "commerce", version: "1.0.0" },
    ],
    distributionMode: "shared-managed",
    availability: "active",
    releaseState: {
      product: "stable",
      solution: "stable",
      solutionReadiness: "buildable",
      template: "stable",
    },
  },
];

export interface ReleaseTrioManifestSnapshot {
  product: { id: string; version: string; status: string };
  solution: { id: string; version: string; status: string; readiness: string };
  template: { id: string; version: string; status: string };
}

export interface OfferBindingReleaseVerificationResult {
  approved: boolean;
  offer: ProvisioningOfferReleaseReference;
  composition: ProvisioningOfferBinding["composition"];
  blockers: string[];
  snapshot: ReleaseTrioManifestSnapshot | null;
}

export class OfferBindingPromotionError extends ProvisioningOfferResolutionError {
  constructor(public readonly blockers: readonly string[]) {
    super("PROVISIONING_OFFER_RELEASE_UNSTABLE");
    this.name = "OfferBindingPromotionError";
  }
}

function defaultRepoRoot(): string {
  const thisDir = dirname(fileURLToPath(import.meta.url));
  return resolve(thisDir, "../../../../..");
}

function readJsonManifest(filePath: string): Record<string, unknown> | null {
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8")) as Record<string, unknown>;
}

/**
 * Verifies a candidate production offer binding against actual product, solution, and template
 * manifests on disk (or an explicit test snapshot), blocking promotion whenever any manifest is partial.
 */
export function verifyOfferBindingReleaseTrio(
  binding: ProvisioningOfferBinding,
  options?: { repoRoot?: string; snapshot?: ReleaseTrioManifestSnapshot },
): OfferBindingReleaseVerificationResult {
  const blockers: string[] = [];
  let snapshot: ReleaseTrioManifestSnapshot | null = options?.snapshot ?? null;

  if (!snapshot) {
    const repoRoot = options?.repoRoot ?? defaultRepoRoot();
    const productManifest = readJsonManifest(join(repoRoot, "products", binding.composition.product.id, "manifest.json"));
    const solutionManifest = readJsonManifest(join(repoRoot, "solutions", binding.composition.solution.id, "manifest.json"));
    const templateManifest = readJsonManifest(join(repoRoot, "templates", binding.composition.template.id, "manifest.json"));

    if (!productManifest || !solutionManifest || !templateManifest) {
      if (!productManifest) blockers.push(`PRODUCT_MANIFEST_MISSING:${binding.composition.product.id}`);
      if (!solutionManifest) blockers.push(`SOLUTION_MANIFEST_MISSING:${binding.composition.solution.id}`);
      if (!templateManifest) blockers.push(`TEMPLATE_MANIFEST_MISSING:${binding.composition.template.id}`);
    } else {
      snapshot = {
        product: {
          id: String(productManifest.id ?? ""),
          version: String(productManifest.version ?? ""),
          status: String(productManifest.status ?? "unknown"),
        },
        solution: {
          id: String(solutionManifest.id ?? ""),
          version: String(solutionManifest.version ?? ""),
          status: String(solutionManifest.status ?? "unknown"),
          readiness: String(solutionManifest.readiness ?? "unknown"),
        },
        template: {
          id: String(templateManifest.id ?? ""),
          version: String(templateManifest.version ?? ""),
          status: String(templateManifest.status ?? "unknown"),
        },
      };
    }
  }

  if (snapshot) {
    if (snapshot.product.version !== binding.composition.product.version) {
      blockers.push(`PRODUCT_VERSION_MISMATCH:${snapshot.product.version}!=${binding.composition.product.version}`);
    }
    if (snapshot.product.status !== "stable") {
      blockers.push(`PRODUCT_MANIFEST_NOT_STABLE:${snapshot.product.status}`);
    }
    if (snapshot.solution.version !== binding.composition.solution.version) {
      blockers.push(`SOLUTION_VERSION_MISMATCH:${snapshot.solution.version}!=${binding.composition.solution.version}`);
    }
    if (snapshot.solution.status !== "stable") {
      blockers.push(`SOLUTION_MANIFEST_NOT_STABLE:${snapshot.solution.status}`);
    }
    if (snapshot.solution.readiness !== "buildable") {
      blockers.push(`SOLUTION_NOT_BUILDABLE:${snapshot.solution.readiness}`);
    }
    if (snapshot.template.version !== binding.composition.template.version) {
      blockers.push(`TEMPLATE_VERSION_MISMATCH:${snapshot.template.version}!=${binding.composition.template.version}`);
    }
    if (snapshot.template.status !== "stable") {
      blockers.push(`TEMPLATE_MANIFEST_NOT_STABLE:${snapshot.template.status}`);
    }
  }

  if (binding.availability !== "active") {
    blockers.push(`OFFER_NOT_ACTIVE:${binding.availability}`);
  }
  if (binding.distributionMode !== "shared-managed") {
    blockers.push(`DISTRIBUTION_NOT_SHARED_MANAGED:${binding.distributionMode}`);
  }

  return {
    approved: blockers.length === 0,
    offer: binding.offer,
    composition: binding.composition,
    blockers,
    snapshot,
  };
}

/**
 * Promotes candidate offer bindings only after every release trio passes manifest readiness checks
 * and records an audit event when promotion succeeds.
 */
export function promoteApprovedProductionOfferBindings(
  candidates: readonly ProvisioningOfferBinding[] = approvedProductionOfferCandidateBindings,
  options?: {
    repoRoot?: string;
    snapshot?: ReleaseTrioManifestSnapshot;
    auditRecorder?: (event: {
      offerId: string;
      offerVersion: string;
      composition: ProvisioningOfferBinding["composition"];
      promotedAt: string;
    }) => void;
  },
): readonly ProvisioningOfferBinding[] {
  const promoted: ProvisioningOfferBinding[] = [];
  const allBlockers: string[] = [];

  for (const candidate of candidates) {
    const verification = verifyOfferBindingReleaseTrio(candidate, options);
    if (!verification.approved) {
      allBlockers.push(...verification.blockers);
      continue;
    }
    promoted.push(candidate);
  }

  if (allBlockers.length > 0 || promoted.length === 0) {
    throw new OfferBindingPromotionError(
      allBlockers.length > 0 ? allBlockers : ["NO_PRODUCTION_OFFER_CANDIDATES"],
    );
  }

  const promotedAt = new Date().toISOString();
  for (const binding of promoted) {
    options?.auditRecorder?.({
      offerId: binding.offer.id,
      offerVersion: binding.offer.version,
      composition: binding.composition,
      promotedAt,
    });
  }

  return promoted;
}
