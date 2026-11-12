import type { ProvisioningOfferBinding } from "./offer-resolution.js";

/** Non-production binding used by integration tests that exercise delivery mechanics. */
export const integrationOfferBinding: ProvisioningOfferBinding = {
  offer: { id: "website-business", version: "2026.1.0" },
  composition: {
    product: { id: "bazion-site", version: "1.0.0" },
    solution: { id: "business-website", version: "1.0.0" },
    template: { id: "node-nextjs", version: "1.0.0" },
  },
  requiredModules: [{ id: "website-content", version: "1.0.0" }],
  optionalModules: [{ id: "analytics", version: "1.0.0" }],
  distributionMode: "shared-managed",
  availability: "active",
  releaseState: {
    product: "stable",
    solution: "stable",
    solutionReadiness: "buildable",
    template: "stable",
  },
};
