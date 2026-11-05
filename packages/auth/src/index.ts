export {
  getActiveTenantContext,
  getCurrentIdentity,
  hasActiveTenantPermission,
  requireActiveTenantPermission,
  requirePlatformRole,
  type ActiveTenantContext,
  type CurrentIdentity,
  type TenantPermissionRequest,
} from "./tenant-context.js";

export {
  ac,
  organizationRoles,
  parseOrganizationRoles,
  rolePermissionMap,
  statement,
  type OrganizationRole,
  type PermissionAction,
  type PermissionResource,
} from "./permissions.js";
