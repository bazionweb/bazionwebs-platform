# Tenant template updates

## Release behavior

Managed tenant sites resolve their template from the shared code catalog on each request. A code release updates every tenant on automatic mode without writing to every tenant row. Tenant-owned settings are stored as sparse overlays, so changes they made remain in place while untouched template fields inherit the latest release.

This applies to all universal package templates, the church template family, and the shared BMI/BEMI school portal template. BMI and BEMI remain separate institution scopes within their shared platform tenant. Their website overlays carry a `tenantId:institutionKey` scope marker, and API reads resolve them against the matching institution.

For automatic releases to be visible, deploy the code containing the template change. Increment the affected template's semantic version in its catalog in the same change. The version is reported by the public website configuration API and the tenant onboarding or institution settings UI.

## Legacy settings

Versionless package and church settings were full snapshots. First read rebases those snapshots against the frozen v1 template defaults, extracts only tenant changes, and stores an automatic overlay with compare-and-swap. This avoids treating old template copy, pages, or offerings as tenant edits. Empty lists are represented as removals where supported, so a deliberate removal does not reappear with a later template release.

## Pinned websites

BYOW repository imports and pinned template snapshots retain their own source snapshot. They are intentionally excluded from automatic template updates. Their status is shown as pinned in the tenant onboarding UI.

## Content and tenant isolation

Template section renderers use configuration belonging to the current tenant. Enquiry forms are shown only when the tenant has the `forms-leads` entitlement and its privacy notice is published; the API checks those conditions again before accepting a message. Internal navigation only includes enabled configured pages. Education navigation and page availability come from the selected institution's website configuration.

The platform stores institution data with both tenant and institution identifiers and verifies the institution selected by the request host. Template inheritance does not move records between BMI, BEMI, or any other tenant.
