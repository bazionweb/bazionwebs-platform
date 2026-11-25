# Permissions (RBAC)

Mirrors the host platform's permission registry conventions
(`products/permissions.json`): `resource:action` grants mapped to tenant
roles. Enforcement is server-side on every admin route via
`requireStaffPermission(tenantId, permission)` — hiding UI is never the
security control.

## Tenant roles

`owner, admin, catalogManager, orderManager, contentEditor, viewer`

## Matrix

| Permission | owner | admin | catalogManager | orderManager | contentEditor | viewer |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| product:read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| product:create | ✓ | ✓ | ✓ | | | |
| product:update | ✓ | ✓ | ✓ | | | |
| product:delete | ✓ | ✓ | ✓ | | | |
| order:read | ✓ | ✓ | ✓ | ✓ | | ✓ |
| order:update | ✓ | ✓ | | ✓ | | |
| order:refund | ✓ | ✓ | | | | |
| customer:read | ✓ | ✓ | | ✓ | | ✓ |
| customer:update | ✓ | ✓ | | ✓ | | |
| coupon:read | ✓ | ✓ | ✓ | | | |
| coupon:manage | ✓ | ✓ | ✓ | | | |
| shipping:read | ✓ | ✓ | | ✓ | | ✓ |
| shipping:manage | ✓ | ✓ | | ✓ | | |
| review:read | ✓ | ✓ | | | ✓ | ✓ |
| review:moderate | ✓ | ✓ | | | ✓ | |
| store:read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| store:update | ✓ | ✓ | | | | |
| theme:update | ✓ | ✓ | | | ✓ | |
| analytics:read | ✓ | ✓ | ✓ | ✓ | | |
| inventory:read | ✓ | ✓ | ✓ | ✓ | | |
| inventory:manage | ✓ | ✓ | ✓ | | | |

## Platform roles

`platform_owner, platform_admin, platform_support, tenant_admin`

| Permission | owner | admin | support |
|---|:--:|:--:|:--:|
| platform:read | ✓ | ✓ | ✓ |
| platform:tenants:manage | ✓ | ✓ | |
| platform:modules:manage | ✓ | ✓ | |

Module entitlement management (`PATCH /api/platform/tenants/:slug/modules`)
requires `platform:modules:manage` and writes an audit event with the acting
operator's identity. Cross-tenant administrative access is distinguishable
via the audit trail (platform actions carry platform actor emails).
