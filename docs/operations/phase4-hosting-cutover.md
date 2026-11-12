# Phase 4 hosting cutover procedure

This procedure links a Bazionweb `HostingAccount` to its Platform provisioning projection without copying provider resource IDs between repositories.

## Current safety gates

- Production offer intake remains closed until a product, solution, template and module release set is stable and its binding has been reviewed.
- Dedicated distribution remains disabled until Platform has a production secret-manager path with tenant-scoped credentials.
- Legacy Dokploy create and remediation paths remain available for unmapped accounts. A mapped account is read-only for Bazionweb status changes and legacy provider remediation.
- No production customer mapping or rollback drill has been recorded yet. The endpoints below implement the procedure; they are not evidence that a cutover has already occurred.

## Read-only cutover inventory

Bazionweb exposes `GET /api/v1/admin/platform-provisioning/hosting-cutover?page=1&limit=50` to `ADMIN` and `SUPER_ADMIN` operators, with a matching admin view at `/admin/hosting/cutover`. The report compares active `HostingAccount` rows against Platform provisioning projections and outbox claims, normalizing domain case, surrounding whitespace, and one trailing dot. It is paginated and performs no writes.

- `ready_to_map`: exactly one ready Platform projection matches the same client and normalized domain and has both a Platform tenant and deployment ID. This is a review candidate, not an automatic mapping.
- `platform_claim_not_ready`: a same-client Platform order exists but is still pending, failed, or has no ready deployment projection; `platformClaimStatuses` shows the source outbox/projection states.
- `ambiguous_platform_claims`: more than one same-client Platform claim matches the domain.
- `domain_claimed_by_other_client`: the domain also appears under a different or unresolved Platform client.
- `linked_*`: an existing link has a missing projection or a detected client/domain/claim conflict.
- `linked`: the current link matches the Platform projection without a detected conflict.
- `legacy_only`: no Platform projection or outbox claim matches the domain.

The report omits Dokploy provider and workload identifiers. Only manually reviewed `ready_to_map` rows should proceed through the evidence-backed mapping procedure below. Never remove or stop a workload based on this report alone.
## Mapping and dual-read

1. Deploy Bazionweb's tolerant status contract and apply its nullable projection/mapping migration `20261112133000_phase4_hosting_deployment_projection` first. This lets it accept both old events and the new optional fields.
2. Apply the Platform migration `0022_phase4_hosting_deployment_projection.sql`, then deploy the Platform API that emits `requestedDomain` and `hostingDeploymentId`.
3. Verify that the Platform status callback or authenticated operation poll has reached Bazionweb. The projection must be `ready` and contain a Platform tenant ID, requested domain, and opaque Platform deployment UUID.
4. Confirm the Platform order domain and Bazionweb hosting domain are the same after lower-casing and removing one trailing dot. Confirm the projection and hosting row belong to the same Bazionweb client.
5. Record a change, incident, migration, ticket, drill, or rollback reference. Do not place secrets, provider IDs, or customer details in the reference.
6. As an `ADMIN` or `SUPER_ADMIN`, call `POST /api/v1/hosting/{hostingAccountId}/platform-deployment-link` with `platformDeploymentId` and `evidenceRef`.
7. Read the account from `/api/v1/hosting/{hostingAccountId}` and confirm both views: the legacy hosting status and the nested `platformProvisioning` status/step/update time. The read response deliberately omits Platform deployment UUID, mapping evidence, and provider resource identifiers.
8. Record any difference in the change evidence and keep the legacy mutation path available through the approved rollback window.

The link operation is idempotent for the same pair, rejects an unready or ambiguous operation, and is one-to-one. Bazionweb writes the link and audit record in one transaction. It does not delete the old workload or clear legacy provider data.

## Rollback

1. Verify that the legacy workload is still present and healthy using the existing approved operations process before changing authority.
2. As an `ADMIN` or `SUPER_ADMIN`, call `POST /api/v1/hosting/{hostingAccountId}/platform-deployment-unlink` with a rollback/drill evidence reference.
3. Confirm the audit entry records the previous Platform deployment UUID and both the mapping and rollback evidence references.
4. Confirm the hosting read no longer includes `platformProvisioning`; legacy status and provider remediation are available again.
5. Leave Platform resources intact until an operator reviews the rollback outcome. Platform stop/remove remains a separately audited Platform action.

The schema change is additive and nullable, so rolling back the Bazionweb application does not require dropping columns. Do not remove the old Dokploy mutation paths until mappings are complete, both views have been reviewed throughout the rollback window, recovery has been drilled, and the Platform cutover gate is green.

## Evidence required to close the live cutover gate

- A reviewed stable production offer binding.
- A safe database-backed cross-repository test run using isolated local test databases.
- Per-account mapping evidence with zero conflicting client/domain matches.
- A successful rollback drill and retained legacy workload recovery evidence.
- An approved rollback window with zero unresolved mismatches.
- A dedicated-mode secret-manager decision before any dedicated offer is enabled.
