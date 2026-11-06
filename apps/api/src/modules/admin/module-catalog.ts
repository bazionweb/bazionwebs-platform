export interface PlatformModuleCatalogItem {
  id: string;
  name: string;
  version: string;
  status: "planned" | "experimental" | "partial" | "stable" | "deprecated";
  tenantModel: "tenant-owned" | "platform-owned" | "mixed" | "not-applicable";
  dependencies: string[];
  description: string;
  defaultEnabled: boolean;
  required: boolean;
  tenantAssignable: boolean;
}

export const platformModuleCatalog: readonly PlatformModuleCatalogItem[] = [
  {
    id: "platform-identity",
    name: "Platform identity and tenant access",
    version: "1.0.0",
    status: "partial",
    tenantModel: "mixed",
    dependencies: [],
    description: "Authentication, tenant membership and access control. Required by the platform.",
    defaultEnabled: true,
    required: true,
    tenantAssignable: false,
  },
  {
    id: "commerce",
    name: "Commerce",
    version: "1.0.0",
    status: "partial",
    tenantModel: "tenant-owned",
    dependencies: ["platform-identity"],
    description: "Product catalogue, guest carts, checkout, orders and payment boundary.",
    defaultEnabled: true,
    required: false,
    tenantAssignable: true,
  },
  {
    id: "analytics",
    name: "Analytics",
    version: "1.0.0",
    status: "partial",
    tenantModel: "tenant-owned",
    dependencies: ["platform-identity"],
    description: "Tenant workspace metrics and analytics authorization surface.",
    defaultEnabled: true,
    required: false,
    tenantAssignable: true,
  },
  {
    id: "audit",
    name: "Audit trail",
    version: "0.1.0",
    status: "partial",
    tenantModel: "mixed",
    dependencies: ["platform-identity"],
    description: "Append-only platform security and administrative event history.",
    defaultEnabled: true,
    required: true,
    tenantAssignable: false,
  },
  {
    id: "notifications",
    name: "Notifications",
    version: "0.1.0",
    status: "partial",
    tenantModel: "mixed",
    dependencies: ["platform-identity"],
    description: "Transactional email/SMS outbox and supervised delivery worker.",
    defaultEnabled: true,
    required: true,
    tenantAssignable: false,
  },
  {
    id: "contacts-crm",
    name: "Contacts and customer directory",
    version: "1.0.0",
    status: "planned",
    tenantModel: "tenant-owned",
    dependencies: ["platform-identity"],
    description: "Customer records, consent, notes, tags and relationships.",
    defaultEnabled: false,
    required: false,
    tenantAssignable: false,
  },
  {
    id: "website-content",
    name: "Website content",
    version: "1.0.0",
    status: "planned",
    tenantModel: "tenant-owned",
    dependencies: ["platform-identity"],
    description: "Tenant pages, content models, revisions and publishing.",
    defaultEnabled: false,
    required: false,
    tenantAssignable: false,
  },
] as const;

export function getPlatformModule(moduleId: string): PlatformModuleCatalogItem | undefined {
  return platformModuleCatalog.find((module) => module.id === moduleId);
}
