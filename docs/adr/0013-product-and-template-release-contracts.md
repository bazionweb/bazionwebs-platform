# ADR 0013: Product and template release contracts

- Status: accepted
- Date: 10 November 2026
- Scope: product composition, template/configuration compatibility and readiness

## Context

Module, solution, template and product versions describe different things. Treating them as a single version makes independent updates difficult and can hide incompatible changes. The current Church/Ministry solution is buildable but partial; a buildable composition is not by itself a production-ready or publishable product. Product release/deployment infrastructure is not yet available.

## Decision

- A product ID is the stable product family key. Its semantic version describes the composition contract: pinned solution, applications, module versions, templates, configuration schema and database compatibility marker.
- A solution version describes its reusable module/role/navigation/default composition. A module version describes its domain contract/implementation. A template version describes its presentation and site structure. A configuration schema version describes valid customer data. These versions advance independently and are pinned by the product manifest.
- Product manifests are Bazion-owned Git source until a real authoring or query workflow justifies a database registry. Once a product version is published, its manifest and referenced artifacts are immutable; changes require a new product version and an explicit compatibility decision.
- Product status is a maturity claim, not a publication or deployment record. `buildable` means its source composition is present; `partial` and `experimental` must not be represented as generally production-ready. `stable` requires a stable solution, every referenced module and template stable, valid pinned app/config/database references, module API/permission/table/RLS/test declarations valid, and the complete required CI gates green.
- Current product validation only accepts buildable solutions. This keeps SME and Ecommerce compositions unavailable as products while their solutions remain roadmap-only.
- Do not declare managed, independent or source-owned distribution modes until the corresponding provisioning/release/source-delivery path has an operational adapter and acceptance evidence. A product manifest describes composition; it does not promise deployment or source distribution.
- Configuration schema changes require an explicit forward transform keyed by source and target schema versions. The transform must validate its output, preserve tenant overrides, exclude secrets, be idempotent, and have tests for success, invalid input and recovery. Do not change a live schema without that compatibility path.
- Database compatibility is pinned to the migration registry marker currently validated for the repository release. Later release infrastructure may widen this to a tested compatibility range when rolling upgrades support it.

## Consequences

- The product manifest validator can reject unstable dependencies and stale versions before publication tooling exists.
- CI validation and build/test results provide readiness evidence; manifest presence alone never implies production support.
- The first Church/Ministry product remains explicitly partial. No installation or release database tables are needed for this contract.
- When immutable artifact publication exists, it must store the manifest digest and app artifact digest together rather than mutating this Git record.
