import { createAccessControl } from "better-auth/plugins/access";

export const statement = {
  organization: ["update"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  product: ["read", "create", "update", "delete"],
  order: ["read", "update", "refund"],
  customer: ["read", "update"],
  store: ["read", "update"],
  churchprivate: ["read", "update"],
  analytics: ["read"],
} as const;

export const ac = createAccessControl(statement);

export const owner = ac.newRole({
  organization: ["update"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  product: ["read", "create", "update", "delete"],
  order: ["read", "update", "refund"],
  customer: ["read", "update"],
  store: ["read", "update"],
  churchprivate: ["read", "update"],
  analytics: ["read"],
});

export const admin = ac.newRole({
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  product: ["read", "create", "update", "delete"],
  order: ["read", "update"],
  customer: ["read", "update"],
  store: ["read", "update"],
  churchprivate: ["read", "update"],
  analytics: ["read"],
});

export const member = ac.newRole({});
export const catalogManager = ac.newRole({
  product: ["read", "create", "update", "delete"],
});
export const orderManager = ac.newRole({
  order: ["read", "update"],
  customer: ["read"],
});
export const contentEditor = ac.newRole({
  store: ["read", "update"],
});
export const viewer = ac.newRole({
  product: ["read"],
  order: ["read"],
  customer: ["read"],
  store: ["read"],
  analytics: ["read"],
});

export const organizationRoles = {
  owner,
  admin,
  member,
  catalogManager,
  orderManager,
  contentEditor,
  viewer,
} as const;

export type OrganizationRole = keyof typeof organizationRoles;
export type PermissionResource = keyof typeof statement;
export type PermissionAction<R extends PermissionResource> = (typeof statement)[R][number];

export const rolePermissionMap = {
  owner: {
    organization: ["update"],
    member: ["create", "update", "delete"],
    invitation: ["create", "cancel"],
    product: ["read", "create", "update", "delete"],
    order: ["read", "update", "refund"],
    customer: ["read", "update"],
    store: ["read", "update"],
    churchprivate: ["read", "update"],
    analytics: ["read"],
  },
  admin: {
    member: ["create", "update", "delete"],
    invitation: ["create", "cancel"],
    product: ["read", "create", "update", "delete"],
    order: ["read", "update"],
    customer: ["read", "update"],
    store: ["read", "update"],
    churchprivate: ["read", "update"],
    analytics: ["read"],
  },
  member: {},
  catalogManager: { product: ["read", "create", "update", "delete"] },
  orderManager: { order: ["read", "update"], customer: ["read"] },
  contentEditor: { store: ["read", "update"] },
  viewer: {
    product: ["read"],
    order: ["read"],
    customer: ["read"],
    store: ["read"],
    analytics: ["read"],
  },
} as const;

export function parseOrganizationRoles(role: string | string[] | null | undefined): string[] {
  const values = Array.isArray(role) ? role : [role ?? ""];
  return values.flatMap((value) => value.split(",")).map((value) => value.trim()).filter(Boolean);
}
