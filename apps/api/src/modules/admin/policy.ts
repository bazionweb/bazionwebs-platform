import { z } from "zod";

export const clientAssignableRoles = [
  "admin",
  "member",
  "catalogManager",
  "orderManager",
  "contentEditor",
  "viewer",
] as const;

export const invitationInputSchema = z.object({
  email: z.string().trim().email().max(254),
  role: z.enum(clientAssignableRoles),
});

export const memberRoleInputSchema = z.object({
  role: z.enum(clientAssignableRoles),
});

export const memberListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export const provisioningReconciliationInputSchema = z.object({
  staleMinutes: z.coerce.number().int().min(5).max(1_440).default(10),
  limit: z.coerce.number().int().min(1).max(500).default(100),
}).strict();


export const platformTenantListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
  status: z.enum(["provisioning", "active", "suspended", "closed"]).optional(),
}).strict();

export const platformTenantLifecycleInputSchema = z.object({
  action: z.enum(["suspend", "restore", "close"]),
}).strict();


export const platformTenantOwnerTransferInputSchema = z.object({
  targetUserId: z.string().trim().min(1).max(128),
}).strict();

export const platformTenantInitialAdminInputSchema = z.object({
  email: z.string().trim().email().max(254),
}).strict();


export const platformTenantOwnerCandidatesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
  q: z.string().trim().max(100).optional(),
}).strict();

export const platformTenantModuleInputSchema = z.object({
  enabled: z.boolean(),
}).strict();

const tenantSettingsPatchSchema = z.object({
  locale: z.string().trim().min(2).max(16).optional(),
  timeZone: z.string().trim().min(1).max(64).optional(),
  defaultCurrency: z.enum(["KES", "USD", "EUR", "GBP"]).optional(),
  brandName: z.string().trim().max(100).optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  supportEmail: z.union([z.string().trim().email().max(254), z.literal("")]).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, {
  message: "At least one settings field must be provided.",
});

export const platformTenantSettingsInputSchema = z.object({
  expectedVersion: z.number().int().min(0).max(2_000_000_000),
  settings: tenantSettingsPatchSchema,
}).strict();

export const platformTenantDomainInputSchema = z.object({
  hostname: z.string().trim().min(3).max(253),
}).strict();

export const platformTenantAuditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
  action: z.string().trim().min(1).max(128).optional(),
}).strict();
