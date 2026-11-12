# Commercial <-> Platform Wire Contract Specification (`v1`)

> **Status**: Active (`1.0.0`)
> **Owner**: Commercial Control Plane (`bazionweb`) & Platform Delivery Plane (`bazionwebs-platform`)
> **Machine-Readable Source of Truth**: [`packages/api-contracts`](file:///d:/bazionweb-platform/bazionwebs-platform/packages/api-contracts/src/index.ts)

---

## 1. Published Contract Inventory

Every cross-system message exchanges plain JSON matching published JSON Schema Draft 2020-12 artifacts generated from Zod schemas in `@bazion/api-contracts` and compiled under `Ajv2020({ allErrors: true, strict: true })` in `Bazionweb`:

| Contract | Schema Artifact | Schema `$id` | Direction |
| :--- | :--- | :--- | :--- |
| `provisionProductRequestV1` | `provision-product-request-v1.schema.json` | `https://schemas.bazionweb.com/platform/provision-product-request/1.0.0` | `bazionweb` -> `bazion-platform` |
| `provisioningOfferCatalogV1` | `provisioning-offer-catalog-v1.schema.json` | `https://schemas.bazionweb.com/platform/provisioning-offer-catalog/1.0.0` | `bazion-platform` -> `bazionweb` |
| `provisioningOperationV1` | `provisioning-operation-v1.schema.json` | `https://schemas.bazionweb.com/platform/provisioning-operation/1.0.0` | `bazion-platform` -> `bazionweb` |
| `provisioningStatusEventV1` | `provisioning-status-event-v1.schema.json` | `https://schemas.bazionweb.com/platform/provisioning-status-event/1.0.0` | `bazion-platform` -> `bazionweb` |
| `subscriptionLifecycleCommandV1` | `subscription-lifecycle-command-v1.schema.json` | `https://schemas.bazionweb.com/platform/subscription-lifecycle-command/1.0.0` | `bazionweb` -> `bazion-platform` |
| `subscriptionLifecycleStatusEventV1` | `subscription-lifecycle-status-event-v1.schema.json` | `https://schemas.bazionweb.com/platform/subscription-lifecycle-status-event/1.0.0` | `bazion-platform` -> `bazionweb` |

Cross-field invariants that JSON Schema Draft 2020-12 delegates cleanly or expresses with `allOf` (`if`/`then`):
- **Operation status invariants**: `status === "ready"` requires non-null UUID `tenantId` and `installationId`; `status` in `["failed", "compensation_required"]` requires non-null `failure: { code, retryable }`.
- **Provisioning status callback correlation**: `event.correlationId === event.operation.correlationId` (enforced by both Zod `.superRefine` and `validateProvisioningStatusEventV1Contract`).
- **Catalog uniqueness**: `(offer.id, offer.version)` pairs across `bindings` and `module.id` across `requiredModules` + `optionalModules` must be unique (enforced by both Zod `.superRefine` and `validateProvisioningOfferCatalogV1`).
- **Grace lifecycle invariant**: `subscriptionLifecycleCommandV1` with `action === "grace"` requires a non-null ISO-8601 `graceEndsAt`.

---

## 2. Versioning, Compatibility & Deprecation Governance

Defined canonically in `CONTRACT_COMPATIBILITY_V1`:

- **Current Wire Version**: `1.0.0`
- **Minimum Supported Version**: `1.0.0`
- **Supported Versions**: `["1.0.0"]`
- **Deprecation Window**: `90` days minimum dual-version overlap for breaking upgrades.

### Additive vs. Breaking Change Rules

1. **Additive changes (`1.x.0` minor bumps)**:
   - Adding new optional response/event fields or widening documented non-destructive consumers without removing or renaming existing fields.
   - Because strict command and webhook validators set `additionalProperties: false` (`.strict()` in Zod), strict request/event additions require explicit schema regeneration (`pnpm --filter @bazion/api-contracts contract:generate`) and coordinated deployment before producers emit new fields.
2. **Breaking changes (`2.0.0` major bumps)**:
   - Removing or renaming fields, turning optional fields required, narrowing enums or regex constraints, or changing semantic meaning of an existing field.
   - Requires publishing `*-v2.schema.json` schemas, serving `1.0.0` and `2.0.0` simultaneously for at least **90 days**, and verifying cross-repo fixture parity before retiring `1.0.0`.
3. **Unsupported Version Behavior (Fail Before Provisioning)**:
   - Both `CommercialProvisioningService.acceptCommand` and `SubscriptionLifecycleService` validate `schemaVersion` **before** opening a database connection or creating any tenant/installation/outbox side effects.
   - Unsupported versions (`"0.9.0"`, `"1.1.0"`, `"2.0.0"`) fail fast with `400` validation errors.

---

## 3. Commercial Data Boundary & PII Non-Persistence Policy

- **No Commercial Prices or Billing Secrets**: `provisionProductRequestV1`, `provisioningOfferCatalogV1`, and `subscriptionLifecycleCommandV1` intentionally exclude invoice totals, currency amounts, taxes, discounts, payment tokens, and credentials.
- **Transient Customer Contact Fields**:
  - `provisionProductRequestV1` includes `customer.displayName` and `customer.primaryContact` (`{ name, email }`) strictly as transient intake attributes when needed for initial tenant/owner setup.
  - Platform delivery tables (`product_provisioning_operations`, `product_provisioning_inbox`, `provisioning_step_attempts`, `provisioning_status_outbox`) persist **only** `externalCustomerId`, `externalOrderId`, and offering/composition version tuples — **never** `displayName` or `primaryContact`.
  - Structured error responses and observability logs redact `email`, `displayName`, `primaryContact`, secrets, and stack traces.
- **Producer Email & Domain Normalization**:
  - `provisionProductRequestV1` enforces lowercase `customer.primaryContact.email` and bare lowercase RFC hostname `requestedDomain` on the wire.
  - Producers (`buildProvisioningRequestsForSettledInvoice`) normalize `client.email.trim().toLowerCase()` and extract bare normalized hostnames before contract validation and outbox persistence.

---

## 4. Lifecycle Command Separation

Subscription billing/dunning states remain separate from initial provisioning:

- **Provisioning (`provisionProductRequestV1`)**: Invoked on settled paid checkout/order lines to create or converge a tenant + version-pinned product installation.
- **Subscription Lifecycle (`subscriptionLifecycleCommandV1`)**: Invoked for commercial billing state changes (`activate`, `grace`, `suspend`, `reactivate`, `cancel`). Operations converge installation operational state idempotently without re-provisioning from scratch or deleting customer data (offboarding/restoration are explicit governed administrative flows).

---

## 5. Upgrades, Plan Changes & Add-On Identification Rule

To prevent in-place corruption of live installations when customers buy add-ons, multi-line orders, or plan upgrades:

1. **Order Line Identity**: Every commercial order line uses deterministic line scoping (`<orderId>:line:<index>`) for both `externalOrderId` and idempotency keys (`bazionweb:order:<invoiceId>:line:<index>:v1`). Never emit bare order IDs when multiple installables or add-ons exist.
2. **Existing Installation Targeting**: Plan upgrades or add-on entitlements targeting an existing installation must reference its immutable `targetInstallationId` (UUID) rather than overloading initial checkout `order.externalOrderId`.
3. **Immutable Pinned Composition**: A live installation's `product`, `solution`, `template`, and pinned release versions are **never** mutated in place through `provisionProductRequestV1`. Upgrades/add-ons must pass platform compatibility checks (`targetConfigurationSchemaVersion` / release compatibility rules) before applying module overrides or migrating to a successor release.

---

## 6. Cross-Repository CI Parity

Both repositories validate against the identical corpus at `v1-contract-fixtures.json` using real catalog offerings (`website-launch`, `website-business`, `bazion-site`, `business-website`, `node-nextjs`):

- **Platform (`d:\bazionweb-platform\bazionwebs-platform`)**: `packages/api-contracts/src/contract-parity.test.ts` asserts byte/object equality of all 6 `.schema.json` artifacts against Zod generators and passes every fixture through Zod v4 validators.
- **Commercial (`D:\bazionweb`)**: `apps/api/src/modules/platform-provisioning/provisioning-contract.spec.ts` compiles all 6 copied `.schema.json` artifacts with `Ajv2020({ allErrors: true, strict: true })` + `ajv-formats` and passes the exact same shared fixtures.

