# Commercial Platform Integration Contract v1 (`bazion-commercial-platform-v1`)

This document specifies the versioned wire contract, security boundaries, evolution rules, and cross-repository parity verification between **Bazionweb** (commercial control plane) and **Bazion Platform** (technical product delivery plane).

Authoritative Zod schemas, compatibility rules, JSON Schema generation, and shared positive/negative conformance fixtures live in `@bazion/api-contracts` ([`packages/api-contracts/src`](../../packages/api-contracts/src)) and generated schemas under [`packages/api-contracts/contracts`](../../packages/api-contracts/contracts).

---

## 1. Separation of Responsibilities

| Boundary | Bazionweb (`@bazionweb/api` / `@bazionweb/web`) | Bazion Platform (`@bazion/api` / `@bazion/admin`) |
|---|---|---|
| **Commercial & Pricing SSOT** | Commercial offers, pricing plans, invoices, checkout sessions, M-Pesa/payment instruments, billing subscriptions, commercial dunning. | Never persists card/payment tokens, prices, or billing ledger state. |
| **Technical Product SSOT** | Fetches read-only bindings from Platform `GET /v1/internal/commercial/provisioning-catalog` and pins resolved composition onto checkout/proposal metadata before sending commands. Fails closed when Platform SSOT is authoritative and catalog is unavailable. | Owns product/solution/template/module manifests (`products/*/manifest.json`), runtime modules (`modules/*/manifest.json`), offer-to-composition allowlist, installation registry, configuration history, and hosting control. |
| **Hosting Authority** | Enforces fail-closed guard (`platform-ssot-guard.ts`) forbidding direct legacy Dokploy/hosting mutation when Platform SSOT is active. | Sole authority for shared-managed entitlement provisioning and dedicated Dokploy deployment orchestration. |
| **Identity Authority (OIDC)** | OIDC Relying Party via server-side BFF endpoints (`/api/auth/oidc/*`); stores no raw bearer tokens in browser `localStorage`. | Sole OIDC Identity Provider (`@bazion/auth`, RS256 JWKS) and platform/tenant RBAC enforcement. |

---

## 2. Published v1 Contract Schemas

All published JSON Schemas (`draft/2020-12`, generated via `pnpm --filter @bazion/api-contracts contract:generate`) are mirrored into Bazionweb (`apps/api/src/modules/platform-provisioning/contracts/`) and verified byte-identically with `pnpm --filter @bazion/api-contracts test` (`contract-parity.test.ts`):

| Schema Name | `$id` | Artifact File | Direction | Min Supported | Current Version |
|---|---|---|---|---|---|
| `provisionProductRequestV1` | `https://schemas.bazionweb.com/platform/provision-product-request/1.0.0` | `provision-product-request-v1.schema.json` | Commercial -> Platform | `1.0.0` | `1.0.0` |
| `provisioningOfferCatalogV1` | `https://schemas.bazionweb.com/platform/provisioning-offer-catalog/1.0.0` | `provisioning-offer-catalog-v1.schema.json` | Platform -> Commercial | `1.0.0` | `1.0.0` |
| `provisioningOperationV1` | `https://schemas.bazionweb.com/platform/provisioning-operation/1.0.0` | `provisioning-operation-v1.schema.json` | Platform -> Commercial | `1.0.0` | `1.0.0` |
| `provisioningStatusEventV1` | `https://schemas.bazionweb.com/platform/provisioning-status-event/1.0.0` | `provisioning-status-event-v1.schema.json` | Platform -> Commercial | `1.0.0` | `1.0.0` |
| `subscriptionLifecycleCommandV1` | `https://schemas.bazionweb.com/platform/subscription-lifecycle-command/1.0.0` | `subscription-lifecycle-command-v1.schema.json` | Commercial -> Platform | `1.0.0` | `1.0.0` |
| `subscriptionLifecycleStatusEventV1` | `https://schemas.bazionweb.com/platform/subscription-lifecycle-status-event/1.0.0` | `subscription-lifecycle-status-event-v1.schema.json` | Platform -> Commercial | `1.0.0` | `1.0.0` |

Shared fixture corpus: [`packages/api-contracts/contracts/v1-contract-fixtures.json`](../../packages/api-contracts/contracts/v1-contract-fixtures.json), consumed by Platform Zod validators and Bazionweb Ajv validators.

---

## 3. Transport, Authentication, Replay & Idempotency Rules

1. **Machine-to-Machine Bearer Auth (Commercial -> Platform):**
   - Short-lived HS256 JWTs (`exp` required, bounded max TTL 300s, `iat` required, strict `iss` / `aud` checks, `jti` replay protection).
   - Scopes enforced per route:
     - `commercial:provisioning:read` -> `GET /v1/internal/commercial/provisioning-catalog`, `GET /v1/internal/commercial/operations/:operationId`, `POST /v1/internal/commercial/reconciliation/report`
     - `commercial:provisioning:write` -> `POST /v1/internal/commercial/provisioning-requests`
     - `commercial:lifecycle:write` -> `POST /v1/internal/commercial/subscription-lifecycle`
     - `commercial:order-claims:write` -> `POST /v1/internal/commercial/order-claims`
2. **Signed Webhook Callbacks (Platform -> Commercial):**
   - Delivered from outbox tables (`product_provisioning_status_outbox` / `commercial_lifecycle_status_outbox`) with HMAC-SHA256 signature headers (`X-Bazion-Signature`, `X-Bazion-Timestamp`, `X-Bazion-Key-Id`, `X-Bazion-Correlation-Id`).
   - Receiver deduplicates by immutable `eventId` and ignores stale out-of-order states using monotonic projection guards (`PlatformProvisioningProjection`).
3. **Request Idempotency & Fingerprinting:**
   - Every command carries `idempotencyKey`, `externalOrderId` (or `orderLineKey`), `correlationId`, and `schemaVersion: "1.0.0"`.
   - Identical retries with the same `idempotencyKey` and canonical SHA-256 request fingerprint return the existing operation (`202 Accepted`, `deduplicated: true`).
   - Reusing an `idempotencyKey` with mutated payload fields fails closed (`409 IDEMPOTENCY_FINGERPRINT_CONFLICT`).

---

## 4. PII, Identifier & Secret Boundaries

- **Identifiers:** Strict lowercase slug/UUID patterns only (`^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$`, exact lowercase semver `^\d+\.\d+\.\d+$`, RFC-safe hostnames, UUID v4/v8 IDs). Uppercase slugs and wildcard hosts are rejected by both Zod and JSON Schema.
- **Transient PII Handling:** `customer.displayName` and `customer.primaryContact` (normalized lowercase email before emission on Bazionweb) are transient request fields used only for initial tenant/account linkage when needed. They are **not** persisted in `product_provisioning_operations`, `product_provisioning_operation_events`, `product_provisioning_status_outbox`, or platform audit metadata, and are stripped/redacted from structured logs (`fastifySensitiveRedactionPaths`, `redactStructuredContext`).
- **Forbidden Wire Content:** Payment amounts, currency codes, transaction receipts, passwords, API keys, database DSNs, and environment secret blobs are strictly prohibited (`additionalProperties: false` across all object schemas).

---

## 5. Compatibility, Versioning & Upgrade Governance

Defined programmatically in [`CONTRACT_COMPATIBILITY_V1`](../../packages/api-contracts/src/contract-compatibility.ts):

- **Supported versions:** `currentVersion: "1.0.0"`, `minimumSupportedVersion: "1.0.0"`. Unsupported or below-minimum `schemaVersion` values fail validation (`400`) before any database mutation or saga execution.
- **Additive changes (`1.x.0` minor bump):** Optional fields on response/event payloads may be added without breaking `1.0.0` consumers; strict request/command objects keep `additionalProperties: false` until both repos negotiate and update schema + fixtures together.
- **Breaking changes (`2.0.0` major bump):** Field removal, enum narrowing, required-field addition, or semantic change requires a major version bump and a minimum **90-day dual-version deprecation window**.
- **Subscription lifecycle separation:** Billing state transitions (`activate`, `grace`, `suspend`, `reactivate`, `cancel`) flow exclusively through `subscriptionLifecycleCommandV1` and `subscriptionLifecycleStatusEventV1` — never overloaded onto initial provisioning requests.
- **Upgrades & add-ons:** Keyed by `<orderId>:line:<index>` targeting an explicit `installationId` and `targetConfigurationSchemaVersion` without mutating existing pinned composition records in place.

