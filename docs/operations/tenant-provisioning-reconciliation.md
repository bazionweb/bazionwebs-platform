# Tenant provisioning reconciliation

## Why this exists

Client organization creation reserves a Bazion tenant row with status `provisioning` before Better Auth creates its organization record. The post-create hook normally maps the organization ID and activates the tenant. If the process fails between those steps, the registry row can remain stuck.

## Operator endpoint

A platform owner or platform administrator may invoke:

```http
POST /v1/admin/platform/tenants/reconcile-provisioning
Content-Type: application/json

{
  "staleMinutes": 10,
  "limit": 100
}
```

Both fields are optional. `staleMinutes` defaults to 10 and accepts 5–1440. `limit` defaults to 100 and accepts 1–500. The endpoint does not accept tenant IDs or organization IDs from the caller.

## Safety rules

1. Only tenant rows in `provisioning` older than the selected threshold are considered.
2. The reconciler looks up Better Auth organizations by the reserved tenant slug.
3. A tenant is activated only if exactly the expected slug is found and its existing organization mapping is empty or matches the found organization ID.
4. The registry update is conditional on the row still being `provisioning`; concurrent changes are reported instead of overwritten.
5. Rows without a matching organization remain in `provisioning`. The operation never deletes tenant rows or invents an organization mapping.
6. Existing mappings that point to a different organization are reported as conflicts for manual investigation.

## Response

The result contains the number scanned and activated, plus bounded lists of unmatched and conflicted tenant IDs/slugs. It does not return authentication secrets, email addresses, or organization member data.

## Operational use

Run the operation after investigating an incomplete client-organization creation, or schedule it from a trusted operations runner. Review unmatched and conflicted entries; do not automatically delete or retry them without confirming the corresponding Better Auth organization state.

The route logs the invoking platform user and aggregate counts. A permanent audit-event module is still planned; this endpoint does not claim to replace it.
